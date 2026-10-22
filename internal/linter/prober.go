package linter

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

// LinkProbeResult represents the live status of an audited URL.
type LinkProbeResult struct {
	URL         string `json:"url"`
	StatusCode  int    `json:"statusCode"`
	OK          bool   `json:"ok"`
	DurationMs  int64  `json:"durationMs"`
	RedirectURL string `json:"redirectUrl,omitempty"`
	Error       string `json:"error,omitempty"`
}

// ProbeLinks tests all given URLs concurrently with a 5-second timeout.
func ProbeLinks(ctx context.Context, links []model.MagicLink) []LinkProbeResult {
	if len(links) == 0 {
		return []LinkProbeResult{}
	}

	results := make([]LinkProbeResult, len(links))
	var wg sync.WaitGroup

	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	for i, l := range links {
		wg.Add(1)
		go func(index int, targetURL string) {
			defer wg.Done()

			start := time.Now()
			req, err := http.NewRequestWithContext(ctx, http.MethodHead, targetURL, nil)
			if err != nil {
				results[index] = LinkProbeResult{
					URL:        targetURL,
					OK:         false,
					Error:      err.Error(),
					DurationMs: time.Since(start).Milliseconds(),
				}
				return
			}
			req.Header.Set("User-Agent", "MailPulse-LinkProber/1.0")

			resp, err := client.Do(req)
			if err != nil {
				// Retry with GET if HEAD is rejected with 405 Method Not Allowed
				reqGet, errGet := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
				if errGet == nil {
					reqGet.Header.Set("User-Agent", "MailPulse-LinkProber/1.0")
					respGet, errGetDo := client.Do(reqGet)
					if errGetDo == nil {
						defer respGet.Body.Close()
						dur := time.Since(start).Milliseconds()
						results[index] = LinkProbeResult{
							URL:        targetURL,
							StatusCode: respGet.StatusCode,
							OK:         respGet.StatusCode >= 200 && respGet.StatusCode < 400,
							DurationMs: dur,
						}
						return
					}
				}

				results[index] = LinkProbeResult{
					URL:        targetURL,
					OK:         false,
					Error:      err.Error(),
					DurationMs: time.Since(start).Milliseconds(),
				}
				return
			}
			defer resp.Body.Close()

			dur := time.Since(start).Milliseconds()
			redirect := ""
			if resp.Request != nil && resp.Request.URL != nil && resp.Request.URL.String() != targetURL {
				redirect = resp.Request.URL.String()
			}

			results[index] = LinkProbeResult{
				URL:         targetURL,
				StatusCode:  resp.StatusCode,
				OK:          resp.StatusCode >= 200 && resp.StatusCode < 400,
				DurationMs:  dur,
				RedirectURL: redirect,
			}
		}(i, l.URL)
	}

	wg.Wait()
	return results
}
