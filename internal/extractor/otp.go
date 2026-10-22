package extractor

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

var (
	// Keyword patterns with trailing code
	keywordCodeRegexes = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(?:verification\s+code|security\s+code|confirmation\s+code|one-time\s+code|passcode|otp|pin|token)\s*(?:is|:|=|-)?\s*[:\s]*([0-9]{4,8})\b`),
		regexp.MustCompile(`(?i)(?:use\s+code|enter\s+code|your\s+code\s+is)\s*[:\s]*([0-9]{4,8})\b`),
		regexp.MustCompile(`(?i)(?:code|pin)\s*[:#]\s*([0-9]{4,8})\b`),
		// Alphanumeric format like G-123456 or AB12-CD34
		regexp.MustCompile(`(?i)(?:code|pin|token|passcode)\s*(?:is|:|=)?\s*[:\s]*([A-Z0-9]{1,6}-[A-Z0-9]{3,8})\b`),
	}

	// Standalone numeric block when preceded by strong context
	numericBlockRegex = regexp.MustCompile(`\b([0-9]{4,8})\b`)

	// Context keywords
	contextKeywords = []string{
		"verification code", "security code", "confirmation code", "one-time passcode",
		"passcode", "otp", "pin code", "login code", "auth code", "verify your",
	}

	// Expiration pattern
	expirationRegex = regexp.MustCompile(`(?i)(valid\s+for\s+[0-9]+\s+(?:minutes?|hours?|days?)|expires?\s+in\s+[0-9]+\s+(?:minutes?|hours?|days?))`)
)

// ExtractOTP inspects email subject, plain text, and HTML to find verification passcodes.
func ExtractOTP(subject, textBody, htmlBody string) *model.OTPInfo {
	combined := subject + "\n" + textBody

	// Try keyword-targeted regexes first
	for _, re := range keywordCodeRegexes {
		matches := re.FindStringSubmatch(combined)
		if len(matches) > 1 {
			code := strings.TrimSpace(matches[1])
			return buildOTPInfo(code, matches[0], combined)
		}
	}

	// Also check in HTML if text was empty or didn't yield matches
	if len(textBody) == 0 && len(htmlBody) > 0 {
		for _, re := range keywordCodeRegexes {
			matches := re.FindStringSubmatch(htmlBody)
			if len(matches) > 1 {
				code := strings.TrimSpace(matches[1])
				return buildOTPInfo(code, matches[0], htmlBody)
			}
		}
	}

	// Fallback: check if subject or body mentions verification context, then search for numeric codes
	lowerCombined := strings.ToLower(combined)
	for _, kw := range contextKeywords {
		idx := strings.Index(lowerCombined, kw)
		if idx != -1 {
			// Search in a window of 100 characters around the keyword
			start := idx - 20
			if start < 0 {
				start = 0
			}
			end := idx + 100
			if end > len(combined) {
				end = len(combined)
			}
			snippet := combined[start:end]
			if numMatch := numericBlockRegex.FindStringSubmatch(snippet); len(numMatch) > 1 {
				return buildOTPInfo(numMatch[1], snippet, combined)
			}
		}
	}

	return nil
}

func buildOTPInfo(code, contextSnippet, fullText string) *model.OTPInfo {
	codeType := "alphanumeric"
	if _, err := fmt.Sscanf(code, "%d", new(int)); err == nil {
		switch len(code) {
		case 4:
			codeType = "numeric_4"
		case 6:
			codeType = "numeric_6"
		case 8:
			codeType = "numeric_8"
		default:
			codeType = fmt.Sprintf("numeric_%d", len(code))
		}
	}

	expiration := ""
	if expMatch := expirationRegex.FindStringSubmatch(fullText); len(expMatch) > 1 {
		expiration = expMatch[1]
	}

	cleanContext := strings.TrimSpace(contextSnippet)
	if len(cleanContext) > 80 {
		cleanContext = cleanContext[:77] + "..."
	}

	return &model.OTPInfo{
		Code:       code,
		Type:       codeType,
		Context:    cleanContext,
		Expiration: expiration,
	}
}
