package mime

import (
	"regexp"
	"strings"
)

var (
	scriptTagRegex = regexp.MustCompile(`(?i)<\s*script[^>]*>[\s\S]*?<\s*/\s*script\s*>`)
	jsEventRegex   = regexp.MustCompile(`(?i)\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)`)
	jsHrefRegex    = regexp.MustCompile(`(?i)href\s*=\s*['"]\s*javascript:[^'"]*['"]`)
)

// SanitizeHTML strips active executable scripts and inline event handlers from email HTML,
// while preserving stylesheets, inline CSS, tables, images, and responsive layout classes.
func SanitizeHTML(html string) string {
	if strings.TrimSpace(html) == "" {
		return ""
	}

	// Remove <script>...</script>
	cleaned := scriptTagRegex.ReplaceAllString(html, "")

	// Remove inline event handlers (onclick=, onload=, onerror=, etc.)
	cleaned = jsEventRegex.ReplaceAllString(cleaned, "")

	// Remove javascript: href protocols
	cleaned = jsHrefRegex.ReplaceAllString(cleaned, `href="#"`)

	return cleaned
}
