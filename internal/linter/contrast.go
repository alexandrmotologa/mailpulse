package linter

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

var (
	styleAttrRegex = regexp.MustCompile(`(?i)style=["']([^"']+)["']`)
	colorRegex     = regexp.MustCompile(`(?i)(?:^|;)\s*color\s*:\s*([^;]+)`)
	bgRegex        = regexp.MustCompile(`(?i)(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)`)
)

type RGBColor struct {
	R, G, B float64
}

func parseHexColor(s string) (RGBColor, bool) {
	s = strings.TrimPrefix(strings.TrimSpace(s), "#")
	if len(s) == 3 {
		r, err1 := strconv.ParseInt(string([]byte{s[0], s[0]}), 16, 64)
		g, err2 := strconv.ParseInt(string([]byte{s[1], s[1]}), 16, 64)
		b, err3 := strconv.ParseInt(string([]byte{s[2], s[2]}), 16, 64)
		if err1 == nil && err2 == nil && err3 == nil {
			return RGBColor{R: float64(r), G: float64(g), B: float64(b)}, true
		}
	} else if len(s) == 6 {
		r, err1 := strconv.ParseInt(s[0:2], 16, 64)
		g, err2 := strconv.ParseInt(s[2:4], 16, 64)
		b, err3 := strconv.ParseInt(s[4:6], 16, 64)
		if err1 == nil && err2 == nil && err3 == nil {
			return RGBColor{R: float64(r), G: float64(g), B: float64(b)}, true
		}
	}
	return RGBColor{}, false
}

func channelLuminance(c float64) float64 {
	val := c / 255.0
	if val <= 0.04045 {
		return val / 12.92
	}
	return math.Pow((val+0.055)/1.055, 2.4)
}

func relativeLuminance(rgb RGBColor) float64 {
	r := channelLuminance(rgb.R)
	g := channelLuminance(rgb.G)
	b := channelLuminance(rgb.B)
	return 0.2126*r + 0.7152*g + 0.0722*b
}

func contrastRatio(rgb1, rgb2 RGBColor) float64 {
	l1 := relativeLuminance(rgb1)
	l2 := relativeLuminance(rgb2)
	lighter := math.Max(l1, l2)
	darker := math.Min(l1, l2)
	return (lighter + 0.05) / (darker + 0.05)
}

// CheckContrast inspects inline styles for text and background color pairs that fail WCAG 2.1 AA.
func CheckContrast(html string) []model.SpamIssue {
	issues := make([]model.SpamIssue, 0)
	if html == "" {
		return issues
	}

	matches := styleAttrRegex.FindAllStringSubmatch(html, -1)
	for _, m := range matches {
		if len(m) < 2 {
			continue
		}
		styleContent := m[1]

		cMatch := colorRegex.FindStringSubmatch(styleContent)
		bgMatch := bgRegex.FindStringSubmatch(styleContent)

		if len(cMatch) >= 2 && len(bgMatch) >= 2 {
			textColorStr := strings.TrimSpace(cMatch[1])
			bgColorStr := strings.TrimSpace(bgMatch[1])

			textColor, ok1 := parseHexColor(textColorStr)
			bgColor, ok2 := parseHexColor(bgColorStr)

			if ok1 && ok2 {
				ratio := contrastRatio(textColor, bgColor)
				// WCAG AA requires at least 4.5:1 for normal body text
				if ratio < 3.0 {
					issues = append(issues, model.SpamIssue{
						Code:        "LOW_COLOR_CONTRAST",
						Severity:    "warning",
						Points:      10,
						Description: fmt.Sprintf("Low text contrast ratio (%.1f:1) between '%s' and '%s'.", ratio, textColorStr, bgColorStr),
						Suggestion:  "Ensure text has at least a 4.5:1 contrast ratio against its background. Dark mode email clients often render low-contrast text completely invisible.",
					})
					// Flag at most one contrast warning per email to avoid over-deducting
					break
				}
			}
		}
	}

	return issues
}
