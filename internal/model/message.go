package model

import (
	"time"
)

// Address represents an email participant with name and address.
type Address struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

// Attachment represents a file attached to an email message.
type Attachment struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
	ContentID   string `json:"contentId,omitempty"` // For inline images (cid:...)
	Data        []byte `json:"-"`                   // Excluded from JSON listing
}

// OTPInfo encapsulates detected one-time verification passcodes.
type OTPInfo struct {
	Code       string `json:"code"`
	Type       string `json:"type"`       // "numeric_4", "numeric_6", "numeric_8", "alphanumeric"
	Context    string `json:"context"`    // Surrounding context phrase
	Expiration string `json:"expiration"` // Detected expiration note if available
}

// MagicLink represents an authentication or action URL extracted from the email.
type MagicLink struct {
	URL        string            `json:"url"`
	Text       string            `json:"text"`
	Host       string            `json:"host"`
	Parameters map[string]string `json:"parameters,omitempty"`
	Category   string            `json:"category"` // "login", "verification", "password_reset", "unsubscribe", "general"
}

// SpamIssue represents a specific deliverability penalty or warning.
type SpamIssue struct {
	Code        string `json:"code"`
	Severity    string `json:"severity"` // "warning", "critical", "info"
	Points      int    `json:"points"`   // Penalty points deducted (0-100 scale)
	Description string `json:"description"`
	Suggestion  string `json:"suggestion"`
}

// SpamReport aggregates all deliverability heuristics.
type SpamReport struct {
	Score            int         `json:"score"`            // 0 to 100
	Verdict          string      `json:"verdict"`          // "pass" (80-100), "warning" (50-79), "fail" (0-49)
	TextToImageRatio float64     `json:"textToImageRatio"` // Percentage
	HtmlSizeBytes    int         `json:"htmlSizeBytes"`
	HasClippingRisk  bool        `json:"hasClippingRisk"`  // True if > 102 kB (Gmail truncate)
	Issues           []SpamIssue `json:"issues"`
}

// Message is the complete domain model for a captured email.
type Message struct {
	ID          string              `json:"id"`
	ReceivedAt  time.Time           `json:"receivedAt"`
	From        Address             `json:"from"`
	To          []Address           `json:"to"`
	Cc          []Address           `json:"cc"`
	Bcc         []Address           `json:"bcc"`
	ReplyTo     []Address           `json:"replyTo"`
	Subject     string              `json:"subject"`
	Snippet     string              `json:"snippet"`
	TextBody    string              `json:"textBody"`
	HTMLBody    string              `json:"htmlBody"`
	RawEML      []byte              `json:"-"`
	Headers     map[string][]string `json:"headers"`
	Attachments []Attachment        `json:"attachments"`
	OTP         *OTPInfo            `json:"otp,omitempty"`
	MagicLinks  []MagicLink         `json:"magicLinks"`
	SpamReport  SpamReport          `json:"spamReport"`
	SizeBytes   int64               `json:"sizeBytes"`
	IsRead      bool                `json:"isRead"`
	IsStarred   bool                `json:"isStarred"`
}

// MessageSummary is a lightweight representation for inbox list views.
type MessageSummary struct {
	ID              string    `json:"id"`
	ReceivedAt      time.Time `json:"receivedAt"`
	From            Address   `json:"from"`
	To              []Address `json:"to"`
	Subject         string    `json:"subject"`
	Snippet         string    `json:"snippet"`
	HasHTML         bool      `json:"hasHtml"`
	HasText         bool      `json:"hasText"`
	AttachmentCount int       `json:"attachmentCount"`
	OTPCode         string    `json:"otpCode,omitempty"`
	SpamScore       int       `json:"spamScore"`
	SpamVerdict     string    `json:"spamVerdict"`
	SizeBytes       int64     `json:"sizeBytes"`
	IsRead          bool      `json:"isRead"`
	IsStarred       bool      `json:"isStarred"`
}

// ToSummary converts a Message into its lightweight summary.
func (m *Message) ToSummary() MessageSummary {
	otpCode := ""
	if m.OTP != nil {
		otpCode = m.OTP.Code
	}
	return MessageSummary{
		ID:              m.ID,
		ReceivedAt:      m.ReceivedAt,
		From:            m.From,
		To:              m.To,
		Subject:         m.Subject,
		Snippet:         m.Snippet,
		HasHTML:         len(m.HTMLBody) > 0,
		HasText:         len(m.TextBody) > 0,
		AttachmentCount: len(m.Attachments),
		OTPCode:         otpCode,
		SpamScore:       m.SpamReport.Score,
		SpamVerdict:     m.SpamReport.Verdict,
		SizeBytes:       m.SizeBytes,
		IsRead:          m.IsRead,
		IsStarred:       m.IsStarred,
	}
}

// WebhookLog records an outgoing webhook delivery attempt.
type WebhookLog struct {
	ID           string    `json:"id"`
	MessageID    string    `json:"messageId"`
	URL          string    `json:"url"`
	AttemptedAt  time.Time `json:"attemptedAt"`
	StatusCode   int       `json:"statusCode"`
	DurationMs   int64     `json:"durationMs"`
	Success      bool      `json:"success"`
	ResponseBody string    `json:"responseBody"`
	Error        string    `json:"error,omitempty"`
}

// ServerStats represents high-level metrics for the MailPulse instance.
type ServerStats struct {
	TotalMessages    int       `json:"totalMessages"`
	UnreadCount      int       `json:"unreadCount"`
	OTPCount         int       `json:"otpCount"`
	FlaggedSpamCount int       `json:"flaggedSpamCount"`
	SMTPPort         int       `json:"smtpPort"`
	WebPort          int       `json:"webPort"`
	StorageType      string    `json:"storageType"`
	UptimeSeconds    int64     `json:"uptimeSeconds"`
	StartedAt        time.Time `json:"startedAt"`
}
