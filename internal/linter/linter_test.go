package linter

import (
	"testing"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

func TestCleanEmailScoresHigh(t *testing.T) {
	msg := &model.Message{
		Subject: "Your order #1042 has shipped",
		Headers: map[string][]string{
			"Message-ID": {"<ship-1042@example.com>"},
			"Date":       {"Thu, 22 Oct 2026 12:00:00 +0000"},
			"From":       {"orders@example.com"},
		},
		TextBody: "Thank you for your order. Tracking number: 9400100000000000000000.",
		HTMLBody: "<p>Thank you for your order. Tracking number: 9400100000000000000000.</p>",
	}

	report := Evaluate(msg)
	if report.Score < 90 {
		t.Errorf("expected high score >= 90 for clean transactional email, got %d", report.Score)
	}
	if report.Verdict != "pass" {
		t.Errorf("expected verdict 'pass', got '%s'", report.Verdict)
	}
}

func TestSpamTriggersAndAllCapsSubject(t *testing.T) {
	msg := &model.Message{
		Subject: "CONGRATULATIONS WINNER CLAIM YOUR 100% FREE PRIZE NOW!!!",
		Headers: map[string][]string{
			// Missing Message-ID and Date
		},
		TextBody: "Act now! Claim your prize today. Guaranteed income!",
		HTMLBody: "<p>Act now! Claim your prize today. Guaranteed income!</p>",
	}

	report := Evaluate(msg)
	if report.Score > 50 {
		t.Errorf("expected low score <= 50 for spam email, got %d", report.Score)
	}
	if report.Verdict != "fail" {
		t.Errorf("expected verdict 'fail', got '%s'", report.Verdict)
	}

	// Verify specific issues were recorded
	codes := make(map[string]bool)
	for _, issue := range report.Issues {
		codes[issue.Code] = true
	}

	if !codes["MISSING_MESSAGE_ID"] {
		t.Errorf("expected MISSING_MESSAGE_ID issue")
	}
	if !codes["ALL_CAPS_SUBJECT"] {
		t.Errorf("expected ALL_CAPS_SUBJECT issue")
	}
	if !codes["EXCESSIVE_EXCLAMATION"] {
		t.Errorf("expected EXCESSIVE_EXCLAMATION issue")
	}
	if !codes["SPAM_TRIGGER_WORDS"] {
		t.Errorf("expected SPAM_TRIGGER_WORDS issue")
	}
}
