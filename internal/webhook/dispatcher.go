package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/google/uuid"
)

// Dispatcher manages outgoing webhook deliveries.
type Dispatcher struct {
	mu         sync.RWMutex
	defaultURL string
	httpClient *http.Client
	logs       []model.WebhookLog
	maxLogs    int
}

// NewDispatcher creates a new webhook dispatcher.
func NewDispatcher(defaultURL string) *Dispatcher {
	return &Dispatcher{
		defaultURL: defaultURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		logs:    make([]model.WebhookLog, 0, 50),
		maxLogs: 50,
	}
}

// SetDefaultURL updates the global webhook target.
func (d *Dispatcher) SetDefaultURL(url string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.defaultURL = url
}

// GetDefaultURL returns the current global webhook URL.
func (d *Dispatcher) GetDefaultURL() string {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.defaultURL
}

// Forward sends an email payload to the specified webhook URL.
func (d *Dispatcher) Forward(ctx context.Context, targetURL string, msg *model.Message) (*model.WebhookLog, error) {
	if targetURL == "" {
		targetURL = d.GetDefaultURL()
	}
	if targetURL == "" {
		return nil, nil // No webhook configured
	}

	payload := map[string]interface{}{
		"id":         msg.ID,
		"receivedAt": msg.ReceivedAt.Format(time.RFC3339),
		"from":       msg.From,
		"to":         msg.To,
		"cc":         msg.Cc,
		"subject":    msg.Subject,
		"text":       msg.TextBody,
		"html":       msg.HTMLBody,
		"otp":        msg.OTP,
		"magicLinks": msg.MagicLinks,
		"spamScore": map[string]interface{}{
			"score":   msg.SpamReport.Score,
			"verdict": msg.SpamReport.Verdict,
		},
		"attachmentCount": len(msg.Attachments),
		"sizeBytes":       msg.SizeBytes,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "MailPulse-Webhook/1.0")
	req.Header.Set("X-MailPulse-Event", "email.received")
	req.Header.Set("X-MailPulse-Message-ID", msg.ID)

	resp, err := d.httpClient.Do(req)
	duration := time.Since(start).Milliseconds()

	log := model.WebhookLog{
		ID:          uuid.New().String(),
		MessageID:   msg.ID,
		URL:         targetURL,
		AttemptedAt: start,
		DurationMs:  duration,
	}

	if err != nil {
		log.Success = false
		log.Error = err.Error()
		log.StatusCode = 0
		d.recordLog(log)
		return &log, err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	log.StatusCode = resp.StatusCode
	log.Success = resp.StatusCode >= 200 && resp.StatusCode < 300
	log.ResponseBody = string(respBytes)

	d.recordLog(log)
	return &log, nil
}

func (d *Dispatcher) recordLog(log model.WebhookLog) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if len(d.logs) >= d.maxLogs {
		d.logs = d.logs[1:]
	}
	d.logs = append(d.logs, log)
}

// GetLogs returns the most recent webhook dispatch attempts.
func (d *Dispatcher) GetLogs() []model.WebhookLog {
	d.mu.RLock()
	defer d.mu.RUnlock()

	result := make([]model.WebhookLog, len(d.logs))
	// Return in reverse (newest first)
	for i, l := range d.logs {
		result[len(d.logs)-1-i] = l
	}
	return result
}
