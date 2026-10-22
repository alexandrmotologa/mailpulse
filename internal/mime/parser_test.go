package mime

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestParsePlainEmail(t *testing.T) {
	raw := "From: Alice <alice@example.com>\r\n" +
		"To: Bob <bob@example.com>\r\n" +
		"Subject: Hello World\r\n" +
		"Date: Thu, 22 Oct 2026 10:00:00 +0000\r\n" +
		"Content-Type: text/plain; charset=utf-8\r\n" +
		"\r\n" +
		"This is a test message."

	parser := NewParser()
	msg, err := parser.Parse([]byte(raw))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if msg.Subject != "Hello World" {
		t.Errorf("expected subject 'Hello World', got '%s'", msg.Subject)
	}
	if msg.From.Address != "alice@example.com" || msg.From.Name != "Alice" {
		t.Errorf("expected Alice <alice@example.com>, got %+v", msg.From)
	}
	if len(msg.To) != 1 || msg.To[0].Address != "bob@example.com" {
		t.Errorf("expected Bob <bob@example.com>, got %+v", msg.To)
	}
	if !strings.Contains(msg.TextBody, "This is a test message.") {
		t.Errorf("expected text body, got '%s'", msg.TextBody)
	}
}

func TestParseMultipartWithCID(t *testing.T) {
	boundary := "boundary-12345"
	fakeImageData := []byte("FAKEPNGIMAGEBITS")
	encodedImage := base64.StdEncoding.EncodeToString(fakeImageData)

	raw := "From: Support <support@example.com>\r\n" +
		"To: Client <client@example.com>\r\n" +
		"Subject: Your Order\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: multipart/related; boundary=\"" + boundary + "\"\r\n" +
		"\r\n" +
		"--" + boundary + "\r\n" +
		"Content-Type: text/html; charset=utf-8\r\n" +
		"\r\n" +
		"<html><body><h1>Order Confirmed</h1><img src=\"cid:logo.png\"><script>alert('xss')</script></body></html>\r\n" +
		"--" + boundary + "\r\n" +
		"Content-Type: image/png; name=\"logo.png\"\r\n" +
		"Content-Disposition: inline; filename=\"logo.png\"\r\n" +
		"Content-ID: <logo.png>\r\n" +
		"Content-Transfer-Encoding: base64\r\n" +
		"\r\n" +
		encodedImage + "\r\n" +
		"--" + boundary + "--\r\n"

	parser := NewParser()
	msg, err := parser.Parse([]byte(raw))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Assert XSS script was removed
	if strings.Contains(msg.HTMLBody, "<script>") || strings.Contains(msg.HTMLBody, "alert") {
		t.Errorf("sanitizer failed to remove script tag: %s", msg.HTMLBody)
	}

	// Assert CID was resolved to data URI
	if !strings.Contains(msg.HTMLBody, "data:image/png;base64,") {
		t.Errorf("cid resolver failed to inject data URI: %s", msg.HTMLBody)
	}

	// Assert attachment was captured
	if len(msg.Attachments) != 1 {
		t.Fatalf("expected 1 attachment, got %d", len(msg.Attachments))
	}
	if msg.Attachments[0].Filename != "logo.png" {
		t.Errorf("expected filename 'logo.png', got '%s'", msg.Attachments[0].Filename)
	}
	if string(msg.Attachments[0].Data) != string(fakeImageData) {
		t.Errorf("attachment data mismatch")
	}
}
