package linter

import (
	"net"
	"net/url"
	"strings"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

// CheckLinks scans magic links and extracted URLs for insecurity and spam triggers.
func CheckLinks(links []model.MagicLink) []model.SpamIssue {
	issues := make([]model.SpamIssue, 0)

	hasInsecureHTTP := false
	hasIPAddressLink := false

	for _, link := range links {
		parsed, err := url.Parse(link.URL)
		if err != nil {
			continue
		}

		// Check for unencrypted HTTP links
		if strings.EqualFold(parsed.Scheme, "http") {
			// Ignore localhost/127.0.0.1 for local dev links
			host := parsed.Hostname()
			if host != "localhost" && host != "127.0.0.1" && host != "0.0.0.0" {
				hasInsecureHTTP = true
			}
		}

		// Check for raw IP addresses in external links
		host := parsed.Hostname()
		if ip := net.ParseIP(host); ip != nil {
			if !ip.IsLoopback() && !ip.IsPrivate() {
				hasIPAddressLink = true
			}
		}
	}

	if hasInsecureHTTP {
		issues = append(issues, model.SpamIssue{
			Code:        "INSECURE_HTTP_LINKS",
			Severity:    "warning",
			Points:      10,
			Description: "Email contains plain HTTP links without SSL/TLS encryption.",
			Suggestion:  "Upgrade all destination hyperlinks to HTTPS to prevent reputation penalties.",
		})
	}

	if hasIPAddressLink {
		issues = append(issues, model.SpamIssue{
			Code:        "RAW_IP_LINKS",
			Severity:    "critical",
			Points:      20,
			Description: "Email contains links pointing directly to public IP addresses instead of domain names.",
			Suggestion:  "Spam filters heavily penalize raw IP links. Always use validated domain names.",
		})
	}

	return issues
}
