package extractor

import (
	"testing"
)

func TestExtractNumericOTP(t *testing.T) {
	tests := []struct {
		name     string
		subject  string
		body     string
		expected string
		codeType string
	}{
		{
			name:     "Explicit verification code",
			subject:  "Verify your email",
			body:     "Your verification code is 481920. It expires in 10 minutes.",
			expected: "481920",
			codeType: "numeric_6",
		},
		{
			name:     "PIN with colon",
			subject:  "Login security alert",
			body:     "Enter PIN: 8392 to approve login request.",
			expected: "8392",
			codeType: "numeric_4",
		},
		{
			name:     "Subject code",
			subject:  "Your code is 91827364",
			body:     "Thank you for signing up with Acme.",
			expected: "91827364",
			codeType: "numeric_8",
		},
		{
			name:     "Alphanumeric token",
			subject:  "Account verification",
			body:     "Your security token is G-847291.",
			expected: "G-847291",
			codeType: "alphanumeric",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			otp := ExtractOTP(tt.subject, tt.body, "")
			if otp == nil {
				t.Fatalf("expected OTP %s, got nil", tt.expected)
			}
			if otp.Code != tt.expected {
				t.Errorf("expected code %s, got %s", tt.expected, otp.Code)
			}
			if otp.Type != tt.codeType {
				t.Errorf("expected type %s, got %s", tt.codeType, otp.Type)
			}
		})
	}
}

func TestExtractMagicLinks(t *testing.T) {
	html := `
	<div>
		<p>Click below to sign in:</p>
		<a href="https://app.example.com/magic?token=xyz123abc">Sign In to Dashboard</a>
		<p>Or reset your password:</p>
		<a href="https://app.example.com/reset-password?key=998877">Reset Password</a>
		<a href="https://example.com/about">About Us</a>
		<a href="https://example.com/unsubscribe?user=123">Unsubscribe</a>
	</div>
	`

	links := ExtractMagicLinks("", html)
	if len(links) != 4 {
		t.Fatalf("expected 4 links, got %d", len(links))
	}

	// Verify categories
	categoryMap := make(map[string]string)
	for _, l := range links {
		categoryMap[l.Text] = l.Category
	}

	if categoryMap["Sign In to Dashboard"] != "login" {
		t.Errorf("expected login category for magic link, got %s", categoryMap["Sign In to Dashboard"])
	}
	if categoryMap["Reset Password"] != "password_reset" {
		t.Errorf("expected password_reset category, got %s", categoryMap["Reset Password"])
	}
	if categoryMap["Unsubscribe"] != "unsubscribe" {
		t.Errorf("expected unsubscribe category, got %s", categoryMap["Unsubscribe"])
	}
	if categoryMap["About Us"] != "general" {
		t.Errorf("expected general category, got %s", categoryMap["About Us"])
	}
}
