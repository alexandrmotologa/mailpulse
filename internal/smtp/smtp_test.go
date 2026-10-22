package smtp

import (
	"context"
	"fmt"
	"net/smtp"
	"testing"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/alexandrmotologa/mailpulse/internal/storage"
	"github.com/alexandrmotologa/mailpulse/internal/webhook"
)

func TestSMTPServerEndToEnd(t *testing.T) {
	port := 11025
	store := storage.NewMemoryStore(10, port, 8025)
	disp := webhook.NewDispatcher("")

	var receivedMsg *model.Message
	msgChan := make(chan *model.Message, 1)

	server, err := NewServer("127.0.0.1", port, store, disp, func(m *model.Message) {
		msgChan <- m
	}, false, nil)
	if err != nil {
		t.Fatalf("failed to create SMTP server: %v", err)
	}

	go func() {
		_ = server.Start()
	}()
	defer server.Close()

	time.Sleep(100 * time.Millisecond)

	// 1. Authenticated email with OTP
	auth := smtp.PlainAuth("", "anyuser", "anypass", "127.0.0.1")
	to := []string{"recipient@example.com"}
	msg := []byte(
		"From: Security Team <security@example.com>\r\n" +
			"To: recipient@example.com\r\n" +
			"Subject: Verification Code 582910\r\n" +
			"Date: Thu, 22 Oct 2026 12:00:00 +0000\r\n" +
			"Message-ID: <test-12345@example.com>\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
			"Your verification code is 582910. Please enter it to continue.\r\n",
	)

	err = smtp.SendMail(fmt.Sprintf("127.0.0.1:%d", port), auth, "security@example.com", to, msg)
	if err != nil {
		t.Fatalf("failed to send email via SMTP: %v", err)
	}

	select {
	case receivedMsg = <-msgChan:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for message to be captured")
	}

	if receivedMsg == nil {
		t.Fatal("expected captured message, got nil")
	}
	if receivedMsg.Subject != "Verification Code 582910" {
		t.Errorf("subject mismatch: got %q", receivedMsg.Subject)
	}
	if receivedMsg.OTP == nil || receivedMsg.OTP.Code != "582910" {
		t.Fatalf("expected OTP 582910, got %+v", receivedMsg.OTP)
	}

	// 2. Unauthenticated email with HTML and Magic Link
	unauthMsg := []byte(
		"From: Acme Auth <auth@example.com>\r\n" +
			"To: developer@example.com\r\n" +
			"Subject: Sign in to your account\r\n" +
			"Date: Thu, 22 Oct 2026 12:05:00 +0000\r\n" +
			"Message-ID: <magic-9988@example.com>\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n\r\n" +
			"<html><body><p>Click <a href=\"https://app.example.com/magic?token=tok_91823\">here</a> to sign in.</p></body></html>\r\n",
	)

	err = smtp.SendMail(fmt.Sprintf("127.0.0.1:%d", port), nil, "auth@example.com", []string{"developer@example.com"}, unauthMsg)
	if err != nil {
		t.Fatalf("failed to send unauthenticated email: %v", err)
	}

	select {
	case receivedMsg = <-msgChan:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for second message")
	}

	if len(receivedMsg.MagicLinks) == 0 {
		t.Fatalf("expected magic link to be extracted, got none")
	}
	if receivedMsg.MagicLinks[0].Category != "login" {
		t.Errorf("expected magic link category 'login', got %s", receivedMsg.MagicLinks[0].Category)
	}

	ctx := context.Background()
	stats, err := store.GetStats(ctx)
	if err != nil {
		t.Fatalf("failed to get stats: %v", err)
	}
	if stats.TotalMessages != 2 {
		t.Errorf("expected 2 total messages, got %d", stats.TotalMessages)
	}
}

func TestSMTPChaosInjection(t *testing.T) {
	port := 11026
	store := storage.NewMemoryStore(10, port, 8025)
	disp := webhook.NewDispatcher("")
	chaos := NewChaosManager()

	// Configure 100% failure rate
	chaos.SetConfig(ChaosConfig{
		Enabled:      true,
		LatencyMs:    10,
		FailureRate:  100,
		ErrorCode:    421,
		ErrorMessage: "Service Temporarily Unavailable",
	})

	server, err := NewServer("127.0.0.1", port, store, disp, nil, false, chaos)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	go func() {
		_ = server.Start()
	}()
	defer server.Close()

	time.Sleep(100 * time.Millisecond)

	msg := []byte("Subject: Test\r\n\r\nBody")
	err = smtp.SendMail(fmt.Sprintf("127.0.0.1:%d", port), nil, "from@test.com", []string{"to@test.com"}, msg)
	if err == nil {
		t.Fatal("expected SMTP send failure under 100% chaos, got nil error")
	}
}
