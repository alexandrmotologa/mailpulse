package linter

import (
	"strings"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

// CheckHeaders audits presence and compliance of standard RFC 5322 headers.
func CheckHeaders(headers map[string][]string, subject string, htmlBody string) []model.SpamIssue {
	issues := make([]model.SpamIssue, 0)

	hasHeader := func(name string) bool {
		for k, v := range headers {
			if strings.EqualFold(k, name) && len(v) > 0 && strings.TrimSpace(v[0]) != "" {
				return true
			}
		}
		return false
	}

	if !hasHeader("Message-ID") {
		issues = append(issues, model.SpamIssue{
			Code:        "MISSING_MESSAGE_ID",
			Severity:    "critical",
			Points:      15,
			Description: "Message is missing a 'Message-ID' header.",
			Suggestion:  "Ensure your mailer assigns a unique Message-ID (e.g. <unique-id@yourdomain.com>).",
		})
	}

	if !hasHeader("Date") {
		issues = append(issues, model.SpamIssue{
			Code:        "MISSING_DATE_HEADER",
			Severity:    "warning",
			Points:      10,
			Description: "Message is missing a standard 'Date' header.",
			Suggestion:  "Add an RFC 2822 timestamp header to avoid spam filter rejections.",
		})
	}

	if strings.TrimSpace(subject) == "" {
		issues = append(issues, model.SpamIssue{
			Code:        "EMPTY_SUBJECT",
			Severity:    "critical",
			Points:      15,
			Description: "Message subject is empty.",
			Suggestion:  "Always provide a concise, descriptive subject line.",
		})
	}

	// Check for promotional email missing List-Unsubscribe
	lowerHtml := strings.ToLower(htmlBody)
	isPromotional := strings.Contains(lowerHtml, "unsubscribe") || strings.Contains(lowerHtml, "opt out") || strings.Contains(lowerHtml, "newsletter")
	if isPromotional && !hasHeader("List-Unsubscribe") {
		issues = append(issues, model.SpamIssue{
			Code:        "MISSING_LIST_UNSUBSCRIBE",
			Severity:    "warning",
			Points:      10,
			Description: "Marketing or promotional email lacks a 'List-Unsubscribe' header.",
			Suggestion:  "Add 'List-Unsubscribe: <mailto:...>, <https://...>' for better inbox deliverability in Gmail and Yahoo.",
		})
	}

	return issues
}
