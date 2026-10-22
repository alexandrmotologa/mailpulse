package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"mime/multipart"
	"net/smtp"
	"net/textproto"
	"time"
)

func main() {
	smtpHost := "127.0.0.1:1025"

	fmt.Println("Sending sample emails to MailPulse on", smtpHost)

	// 1. Send OTP Verification Code
	sendOTP(smtpHost)
	time.Sleep(300 * time.Millisecond)

	// 2. Send Magic Link Login
	sendMagicLink(smtpHost)
	time.Sleep(300 * time.Millisecond)

	// 3. Send E-Commerce Receipt with inline CID image & attachment
	sendOrderReceipt(smtpHost)
	time.Sleep(300 * time.Millisecond)

	// 4. Send Promotional Spam email (testing linter)
	sendSpamPromo(smtpHost)
	time.Sleep(300 * time.Millisecond)

	fmt.Println("All test emails dispatched successfully!")
}

func sendOTP(host string) {
	to := []string{"alex@example.com"}
	msg := []byte(
		"From: Acme Security <security@acme.internal>\r\n" +
			"To: alex@example.com\r\n" +
			"Subject: Your verification code is 849201\r\n" +
			"Date: " + time.Now().Format(time.RFC1123Z) + "\r\n" +
			"Message-ID: <otp-849201@acme.internal>\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n\r\n" +
			`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:30px;background:#f8fafc;">
			<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
			<h2 style="color:#0f172a;margin-top:0;">Account Verification</h2>
			<p style="color:#475569;">Please use the one-time code below to verify your login session:</p>
			<div style="background:#f1f5f9;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
			<span style="font-family:monospace;font-size:36px;font-weight:bold;letter-spacing:6px;color:#4f46e5;">849201</span>
			</div>
			<p style="color:#64748b;font-size:13px;">This verification code expires in 10 minutes. If you did not request this, please disregard.</p>
			</div></body></html>`,
	)

	_ = smtp.SendMail(host, nil, "security@acme.internal", to, msg)
}

func sendMagicLink(host string) {
	to := []string{"developer@company.org"}
	msg := []byte(
		"From: Acme Auth <auth@example.com>\r\n" +
			"To: developer@company.org\r\n" +
			"Subject: Instant sign-in link for Acme Cloud\r\n" +
			"Date: " + time.Now().Format(time.RFC1123Z) + "\r\n" +
			"Message-ID: <magic-link-994@example.com>\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n\r\n" +
			`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:30px;background:#f8fafc;">
			<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
			<h2 style="color:#0f172a;margin-top:0;">Sign In with Magic Link</h2>
			<p style="color:#475569;">Click the button below to sign in instantly without a password:</p>
			<div style="text-align:center;margin:28px 0;">
			<a href="https://cloud.acme.internal/auth/callback?token=sec_991823abx&user=usr_5821" style="background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Sign In to Workspace</a>
			</div>
			<p style="color:#94a3b8;font-size:12px;">Valid for 30 minutes. If button does not work, copy and paste the link into your browser.</p>
			</div></body></html>`,
	)

	_ = smtp.SendMail(host, nil, "auth@example.com", to, msg)
}

func sendOrderReceipt(host string) {
	to := []string{"customer@shop.com"}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	boundary := writer.Boundary()

	headers := fmt.Sprintf("From: Acme Store <billing@acme.internal>\r\n"+
		"To: customer@shop.com\r\n"+
		"Subject: Order Receipt #ORD-98214 ($89.00)\r\n"+
		"Date: %s\r\n"+
		"Message-ID: <order-receipt-98214@acme.internal>\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: multipart/related; boundary=\"%s\"\r\n\r\n", time.Now().Format(time.RFC1123Z), boundary)

	buf.WriteString(headers)

	// HTML part
	htmlPart, _ := writer.CreatePart(textproto.MIMEHeader{
		"Content-Type": {"text/html; charset=UTF-8"},
	})
	htmlPart.Write([]byte(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#f1f5f9;">
		<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;border:1px solid #cbd5e1;">
		<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:16px;">
		  <img src="cid:logo.png" width="48" height="48" alt="Logo" style="display:inline-block;vertical-align:middle;margin-right:12px;">
		  <h3 style="margin:0;display:inline-block;vertical-align:middle;color:#0f172a;">Order #ORD-98214</h3>
		</div>
		<p style="color:#475569;margin-top:20px;">Thank you for your business. Your payment of <strong>$89.00</strong> was received.</p>
		<table style="width:100%;border-collapse:collapse;margin:20px 0;">
		  <tr style="border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;"><th style="text-align:left;padding:8px 0;">Item</th><th style="text-align:right;padding:8px 0;">Amount</th></tr>
		  <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 0;color:#1e293b;">Developer Seat (Monthly)</td><td style="text-align:right;padding:10px 0;color:#1e293b;font-weight:600;">$89.00</td></tr>
		</table>
		<div style="text-align:right;font-size:16px;font-weight:bold;color:#0f172a;">Total: $89.00</div>
		</div></body></html>`))

	// Inline image part (CID)
	pngBytes := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
		0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
		0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
		0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
	}

	imgPart, _ := writer.CreatePart(textproto.MIMEHeader{
		"Content-Type":              {"image/png; name=\"logo.png\""},
		"Content-Disposition":       {"inline; filename=\"logo.png\""},
		"Content-ID":                {"<logo.png>"},
		"Content-Transfer-Encoding": {"base64"},
	})
	imgPart.Write([]byte(base64.StdEncoding.EncodeToString(pngBytes)))

	writer.Close()

	_ = smtp.SendMail(host, nil, "billing@acme.internal", to, buf.Bytes())
}

func sendSpamPromo(host string) {
	to := []string{"target@example.com"}
	msg := []byte(
		"From: Mega Deals <deals@spam-network.biz>\r\n" +
			"To: target@example.com\r\n" +
			"Subject: CLAIM YOUR 100% FREE REWARD NOW BEFORE TIME EXPIRES!!!\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n\r\n" +
			`<!DOCTYPE html><html><body style="background:yellow;color:red;font-size:24px;text-align:center;">
			<h1>ACT NOW! YOU WON 100% FREE CASH!</h1>
			<p>Guaranteed income! Click here now: <a href="http://192.168.1.50/prizes">CLAIM PRIZE</a></p>
			<p>Buy direct with no credit card required!</p>
			</body></html>`,
	)

	_ = smtp.SendMail(host, nil, "deals@spam-network.biz", to, msg)
}
