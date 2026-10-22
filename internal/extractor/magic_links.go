package extractor

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

var (
	anchorTagRegex = regexp.MustCompile(`(?i)<a\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)</a>`)
	rawURLRegex    = regexp.MustCompile(`https?://[^\s<>"']+`)
	htmlStripRegex = regexp.MustCompile(`<[^>]*>`)
)

// ExtractMagicLinks parses URLs from text and HTML bodies, categorizing auth and magic links.
func ExtractMagicLinks(textBody, htmlBody string) []model.MagicLink {
	linkMap := make(map[string]model.MagicLink)

	// 1. Extract from HTML anchor tags (includes link label text!)
	if htmlBody != "" {
		matches := anchorTagRegex.FindAllStringSubmatch(htmlBody, -1)
		for _, m := range matches {
			if len(m) >= 3 {
				rawLink := strings.TrimSpace(m[1])
				linkText := strings.TrimSpace(htmlStripRegex.ReplaceAllString(m[2], ""))
				addLinkIfValid(rawLink, linkText, linkMap)
			}
		}
	}

	// 2. Extract plain URLs from text body
	if textBody != "" {
		matches := rawURLRegex.FindAllString(textBody, -1)
		for _, rawLink := range matches {
			addLinkIfValid(rawLink, "", linkMap)
		}
	}

	// Convert map to slice and prioritize authentication/magic links
	var results []model.MagicLink
	var authLinks []model.MagicLink
	var otherLinks []model.MagicLink

	for _, link := range linkMap {
		if link.Category != "general" {
			authLinks = append(authLinks, link)
		} else {
			otherLinks = append(otherLinks, link)
		}
	}

	// Auth links come first
	results = append(results, authLinks...)
	results = append(results, otherLinks...)

	return results
}

func addLinkIfValid(rawLink, linkText string, linkMap map[string]model.MagicLink) {
	// Skip mailto, tel, javascript or local anchors
	if strings.HasPrefix(rawLink, "mailto:") ||
		strings.HasPrefix(rawLink, "tel:") ||
		strings.HasPrefix(rawLink, "javascript:") ||
		strings.HasPrefix(rawLink, "#") {
		return
	}

	parsed, err := url.Parse(rawLink)
	if err != nil || parsed.Host == "" {
		return
	}

	// Deduplicate by clean URL
	cleanURL := rawLink
	if existing, exists := linkMap[cleanURL]; exists {
		// Update linkText if current one is better
		if existing.Text == "" && linkText != "" {
			existing.Text = linkText
			linkMap[cleanURL] = existing
		}
		return
	}

	// Parse query parameters
	queryParams := make(map[string]string)
	for k, v := range parsed.Query() {
		if len(v) > 0 {
			queryParams[k] = v[0]
		}
	}

	category := classifyURL(parsed, linkText, queryParams)

	if linkText == "" {
		linkText = parsed.Host + parsed.Path
	}

	linkMap[cleanURL] = model.MagicLink{
		URL:        cleanURL,
		Text:       linkText,
		Host:       parsed.Host,
		Parameters: queryParams,
		Category:   category,
	}
}

func classifyURL(u *url.URL, linkText string, query map[string]string) string {
	combined := strings.ToLower(u.Path + " " + linkText)

	// Check query keys for authentication tokens
	for key := range query {
		lowerKey := strings.ToLower(key)
		if lowerKey == "token" || lowerKey == "auth" || lowerKey == "code" ||
			lowerKey == "magic" || lowerKey == "verification_token" || lowerKey == "access_token" {
			if strings.Contains(combined, "reset") || strings.Contains(combined, "password") {
				return "password_reset"
			}
			if strings.Contains(combined, "verify") || strings.Contains(combined, "confirm") {
				return "verification"
			}
			return "login"
		}
	}

	if strings.Contains(combined, "unsubscribe") || strings.Contains(combined, "opt-out") {
		return "unsubscribe"
	}
	if strings.Contains(combined, "reset-password") || strings.Contains(combined, "forgot-password") || strings.Contains(combined, "password_reset") {
		return "password_reset"
	}
	if strings.Contains(combined, "verify") || strings.Contains(combined, "confirm-email") || strings.Contains(combined, "activate") {
		return "verification"
	}
	if strings.Contains(combined, "login") || strings.Contains(combined, "sign-in") || strings.Contains(combined, "magic-link") {
		return "login"
	}

	return "general"
}
