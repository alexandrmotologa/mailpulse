package sample

import (
	"encoding/base64"
	"fmt"
	"math/rand"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/extractor"
	"github.com/alexandrmotologa/mailpulse/internal/linter"
	"github.com/alexandrmotologa/mailpulse/internal/mime"
	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/google/uuid"
)

// Generate builds a realistic sample message of the specified template type.
func Generate(template string) *model.Message {
	switch template {
	case "reset":
		return generatePasswordReset()
	case "receipt":
		return generateOrderReceipt()
	case "spam":
		return generateSpamMarketing()
	case "alert":
		return generateSecurityAlert()
	case "otp":
		fallthrough
	default:
		return generateOTPVerification()
	}
}

func generateOTPVerification() *model.Message {
	code := fmt.Sprintf("%06d", rand.Intn(900000)+100000)
	id := uuid.New().String()
	now := time.Now().UTC()

	subject := fmt.Sprintf("Your verification code is %s", code)
	textBody := fmt.Sprintf("Hello,\n\nUse the verification code %s to complete your sign in. This code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nAcme Security Team", code)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .badge { display: inline-block; background: #eff6ff; color: #2563eb; font-weight: 600; font-size: 12px; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #0f172a; }
    p { font-size: 15px; line-height: 24px; color: #475569; margin: 0 0 20px; }
    .code-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; }
    .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7; }
    .footer { font-size: 13px; color: #94a3b8; text-align: center; margin-top: 32px; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #0f172a !important; color: #f8fafc !important; }
      .card { background: #1e293b !important; border-color: #334155 !important; }
      h1 { color: #f8fafc !important; }
      p { color: #94a3b8 !important; }
      .code-box { background: #0f172a !important; border-color: #475569 !important; }
      .code { color: #38bdf8 !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Verification Required</div>
    <h1>Verify Your Sign In</h1>
    <p>Please enter the following one-time passcode to verify your account sign in.</p>
    <div class="code-box">
      <div class="code">%s</div>
    </div>
    <p>This verification code expires in 10 minutes. If you did not attempt this sign in, change your password immediately.</p>
    <div class="footer">&copy; 2026 Acme Corp. All rights reserved.</div>
  </div>
</body>
</html>`, code)

	msg := &model.Message{
		ID:         id,
		ReceivedAt: now,
		From:       model.Address{Name: "Acme Security", Address: "security@acme.internal"},
		To:         []model.Address{{Name: "Dev User", Address: "developer@example.com"}},
		Subject:    subject,
		Snippet:    fmt.Sprintf("Your verification code is %s. Valid for 10 minutes.", code),
		TextBody:   textBody,
		HTMLBody:   htmlBody,
		Headers: map[string][]string{
			"Message-ID":   {fmt.Sprintf("<%s@acme.internal>", id)},
			"Date":         {now.Format(time.RFC1123Z)},
			"Content-Type": {"text/html; charset=UTF-8"},
			"X-Mailer":     {"Acme-Auth-Engine/3.2"},
		},
		SizeBytes: int64(len(htmlBody) + len(textBody)),
	}

	msg.OTP = extractor.ExtractOTP(msg.Subject, msg.TextBody, msg.HTMLBody)
	msg.MagicLinks = extractor.ExtractMagicLinks(msg.TextBody, msg.HTMLBody)
	msg.SpamReport = linter.Evaluate(msg)
	return msg
}

func generatePasswordReset() *model.Message {
	id := uuid.New().String()
	token := uuid.New().String()
	resetURL := fmt.Sprintf("https://auth.example.com/reset-password?token=%s&uid=usr_827164", token)
	now := time.Now().UTC()

	subject := "Reset your Acme account password"
	textBody := fmt.Sprintf("Hello,\n\nWe received a request to reset your Acme password. Visit the link below to set a new password:\n\n%s\n\nThis magic link is valid for 1 hour.\n\nBest,\nAcme Security", resetURL)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b; }
    .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    p { line-height: 1.5; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Password Reset Request</h2>
    <p>We received a request to reset the password associated with this account. Click the button below to choose a new password:</p>
    <a href="%s" class="btn">Reset Password</a>
    <p>If you didn't ask for this, you can ignore this email.</p>
  </div>
</body>
</html>`, resetURL)

	msg := &model.Message{
		ID:         id,
		ReceivedAt: now,
		From:       model.Address{Name: "Acme Accounts", Address: "accounts@example.com"},
		To:         []model.Address{{Name: "Engineering Team", Address: "team@example.com"}},
		Subject:    subject,
		Snippet:    "We received a request to reset your Acme password.",
		TextBody:   textBody,
		HTMLBody:   htmlBody,
		Headers: map[string][]string{
			"Message-ID": {fmt.Sprintf("<reset-%s@example.com>", id)},
			"Date":       {now.Format(time.RFC1123Z)},
		},
		SizeBytes: int64(len(htmlBody) + len(textBody)),
	}

	msg.OTP = extractor.ExtractOTP(msg.Subject, msg.TextBody, msg.HTMLBody)
	msg.MagicLinks = extractor.ExtractMagicLinks(msg.TextBody, msg.HTMLBody)
	msg.SpamReport = linter.Evaluate(msg)
	return msg
}

func generateOrderReceipt() *model.Message {
	id := uuid.New().String()
	orderID := fmt.Sprintf("ORD-%05d", rand.Intn(90000)+10000)
	now := time.Now().UTC()

	// 1x1 transparent PNG or simple SVG icon data for inline CID attachment
	svgIcon := `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`
	iconData := []byte(svgIcon)

	att := mime.NewAttachment("logo.svg", "image/svg+xml", "<order-logo.svg>", iconData)

	subject := fmt.Sprintf("Receipt for Order #%s ($129.00)", orderID)
	textBody := fmt.Sprintf("Thank you for your purchase!\nOrder: %s\nTotal: $129.00\nItems: Developer Pro Subscription (1 Year)\n\nView receipt online: https://example.com/receipts/%s", orderID, orderID)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: sans-serif; background-color: #f1f5f9; padding: 24px; color: #0f172a; }
    .invoice { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #cbd5e1; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; }
    table { width: 100%%; border-collapse: collapse; margin: 24px 0; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .total { font-weight: bold; font-size: 18px; text-align: right; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        <img src="cid:order-logo.svg" width="48" height="48" alt="Logo">
        <h2>Order Confirmation</h2>
      </div>
      <div><strong>Order #%s</strong></div>
    </div>
    <table>
      <thead>
        <tr><th>Description</th><th>Qty</th><th>Price</th></tr>
      </thead>
      <tbody>
        <tr><td>MailPulse Developer Pro (Annual)</td><td>1</td><td>$129.00</td></tr>
      </tbody>
    </table>
    <div class="total">Total Paid: $129.00</div>
  </div>
</body>
</html>`, orderID)

	resolvedHTML := mime.ResolveInlineCIDImages(htmlBody, []model.Attachment{att})

	msg := &model.Message{
		ID:          id,
		ReceivedAt:  now,
		From:        model.Address{Name: "Acme Billing", Address: "billing@acme.internal"},
		To:          []model.Address{{Name: "Customer", Address: "customer@example.com"}},
		Subject:     subject,
		Snippet:     fmt.Sprintf("Order #%s confirmed. Total paid: $129.00.", orderID),
		TextBody:    textBody,
		HTMLBody:    resolvedHTML,
		Attachments: []model.Attachment{att},
		Headers: map[string][]string{
			"Message-ID": {fmt.Sprintf("<invoice-%s@acme.internal>", id)},
			"Date":       {now.Format(time.RFC1123Z)},
		},
		SizeBytes: int64(len(htmlBody) + len(textBody) + len(iconData)),
	}

	msg.OTP = extractor.ExtractOTP(msg.Subject, msg.TextBody, msg.HTMLBody)
	msg.MagicLinks = extractor.ExtractMagicLinks(msg.TextBody, msg.HTMLBody)
	msg.SpamReport = linter.Evaluate(msg)
	return msg
}

func generateSpamMarketing() *model.Message {
	id := uuid.New().String()
	now := time.Now().UTC()

	subject := "CONGRATULATIONS WINNER CLAIM YOUR 100% FREE PRIZE NOW!!!"
	textBody := "ACT NOW! You have been selected as our grand prize winner. Double your money guaranteed! Click here to claim your cash: http://192.0.2.1/claim-prize"

	htmlBody := `<!DOCTYPE html>
<html>
<body style="background: yellow; color: red; font-size: 24px; text-align: center;">
  <h1>CONGRATULATIONS! YOU WON!</h1>
  <p>100% FREE! GUARANTEED CASH PRIZE! ACT NOW BEFORE TIME EXPIRES!</p>
  <a href="http://192.0.2.1/claim-prize">CLICK HERE NOW FOR FAST CASH</a>
  <p>Urgent action required! Buy direct with no credit card required!</p>
</body>
</html>`

	msg := &model.Message{
		ID:         id,
		ReceivedAt: now,
		From:       model.Address{Name: "Prizes Dept", Address: "winner@spammer-domain.net"},
		To:         []model.Address{{Name: "Lucky Recipient", Address: "target@example.com"}},
		Subject:    subject,
		Snippet:    "ACT NOW! You have been selected as our grand prize winner.",
		TextBody:   textBody,
		HTMLBody:   htmlBody,
		Headers: map[string][]string{
			// Intentionally missing Message-ID and Date to test linter deductions
		},
		SizeBytes: int64(len(htmlBody) + len(textBody)),
	}

	msg.OTP = extractor.ExtractOTP(msg.Subject, msg.TextBody, msg.HTMLBody)
	msg.MagicLinks = extractor.ExtractMagicLinks(msg.TextBody, msg.HTMLBody)
	msg.SpamReport = linter.Evaluate(msg)
	return msg
}

func generateSecurityAlert() *model.Message {
	id := uuid.New().String()
	now := time.Now().UTC()

	subject := "Security Alert: New sign-in from Chrome on macOS"
	textBody := fmt.Sprintf("A new sign-in was detected on your account.\nTime: %s\nIP: 203.0.113.42 (San Francisco, CA)\nDevice: Chrome 132 on macOS\n\nIf this was not you, review active sessions immediately: https://example.com/security/sessions", now.Format(time.RFC822))

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: sans-serif; background-color: #fef2f2; padding: 24px; }
    .card { max-width: 500px; margin: 0 auto; background: #ffffff; padding: 28px; border-radius: 8px; border: 1px solid #fecaca; }
    h2 { color: #dc2626; margin-top: 0; }
    .details { background: #f8fafc; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0; font-size: 14px; }
    a.btn { display: inline-block; background: #dc2626; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h2>New Sign-In Alert</h2>
    <p>We detected a login to your account from an unrecognized device.</p>
    <div class="details">
      <strong>Device:</strong> Chrome 132 on macOS<br>
      <strong>Location:</strong> San Francisco, CA (203.0.113.42)<br>
      <strong>Time:</strong> %s
    </div>
    <a href="https://example.com/security/sessions" class="btn">Review Activity</a>
  </div>
</body>
</html>`, now.Format(time.RFC822))

	msg := &model.Message{
		ID:         id,
		ReceivedAt: now,
		From:       model.Address{Name: "Security Notifier", Address: "security-noreply@example.com"},
		To:         []model.Address{{Name: "Engineering Team", Address: "engineer@example.com"}},
		Subject:    subject,
		Snippet:    "A new sign-in was detected on your account.",
		TextBody:   textBody,
		HTMLBody:   htmlBody,
		Headers: map[string][]string{
			"Message-ID": {fmt.Sprintf("<alert-%s@example.com>", id)},
			"Date":       {now.Format(time.RFC1123Z)},
		},
		SizeBytes: int64(len(htmlBody) + len(textBody)),
	}

	msg.OTP = extractor.ExtractOTP(msg.Subject, msg.TextBody, msg.HTMLBody)
	msg.MagicLinks = extractor.ExtractMagicLinks(msg.TextBody, msg.HTMLBody)
	msg.SpamReport = linter.Evaluate(msg)
	return msg
}

// GenerateBase64Placeholder produces a minimal valid PNG in Base64
func GenerateBase64Placeholder() string {
	// 1x1 transparent PNG bytes
	png := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
		0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
		0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
		0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
	}
	return base64.StdEncoding.EncodeToString(png)
}
