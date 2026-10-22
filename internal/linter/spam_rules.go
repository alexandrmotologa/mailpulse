package linter

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

var (
	spamTriggerWords = []string{
		"100% free", "act now", "urgent", "claim your prize", "congratulations, you won",
		"earn extra cash", "risk free", "guaranteed income", "double your money",
		"no credit card required", "click here now", "buy direct", "exclusive deal today",
		"winner", "prize draw", "miracle", "fast cash",
	}

	imgTagRegex     = regexp.MustCompile(`(?i)<img[^>]+>`)
	htmlStripRegex  = regexp.MustCompile(`<[^>]*>`)
	multiExclaimReg = regexp.MustCompile(`!{2,}`)
)

// Evaluate computes the deliverability and spam score for a captured message.
func Evaluate(msg *model.Message) model.SpamReport {
	issues := make([]model.SpamIssue, 0)
	totalScore := 100

	// 1. Audit Standard RFC 5322 Headers
	headerIssues := CheckHeaders(msg.Headers, msg.Subject, msg.HTMLBody)
	issues = append(issues, headerIssues...)

	// 2. Audit Links
	linkIssues := CheckLinks(msg.MagicLinks)
	issues = append(issues, linkIssues...)

	// 3. Audit Color Contrast (WCAG 2.1 AA)
	contrastIssues := CheckContrast(msg.HTMLBody)
	issues = append(issues, contrastIssues...)

	// 4. Subject Line Analysis
	subject := strings.TrimSpace(msg.Subject)
	if len(subject) > 0 {
		letters := 0
		uppers := 0
		for _, r := range subject {
			if unicode.IsLetter(r) {
				letters++
				if unicode.IsUpper(r) {
					uppers++
				}
			}
		}

		if letters >= 6 && float64(uppers)/float64(letters) > 0.40 {
			issues = append(issues, model.SpamIssue{
				Code:        "ALL_CAPS_SUBJECT",
				Severity:    "critical",
				Points:      20,
				Description: "Subject line contains excessive uppercase letters (> 40%).",
				Suggestion:  "Use standard sentence or title case. All-caps triggers spam filters across major providers.",
			})
		}

		if multiExclaimReg.MatchString(subject) {
			issues = append(issues, model.SpamIssue{
				Code:        "EXCESSIVE_EXCLAMATION",
				Severity:    "warning",
				Points:      10,
				Description: "Subject line contains multiple consecutive exclamation marks.",
				Suggestion:  "Remove repeated exclamation marks to prevent aggressive spam classification.",
			})
		}
	}

	// 4. Spam Trigger Phrase Check in Subject and Body
	combinedText := strings.ToLower(msg.Subject + " " + msg.TextBody)
	if msg.HTMLBody != "" {
		combinedText += " " + strings.ToLower(htmlStripRegex.ReplaceAllString(msg.HTMLBody, " "))
	}

	var foundTriggers []string
	for _, phrase := range spamTriggerWords {
		if strings.Contains(combinedText, phrase) {
			foundTriggers = append(foundTriggers, phrase)
		}
	}

	if len(foundTriggers) > 0 {
		deduction := len(foundTriggers) * 10
		if deduction > 30 {
			deduction = 30
		}
		issues = append(issues, model.SpamIssue{
			Code:        "SPAM_TRIGGER_WORDS",
			Severity:    "warning",
			Points:      deduction,
			Description: "Email content contains known spam trigger phrases: " + strings.Join(foundTriggers, ", "),
			Suggestion:  "Rephrase promotional copy using neutral, transactional language.",
		})
	}

	// 5. Gmail 102 kB Clipping Warning
	htmlSizeBytes := len(msg.HTMLBody)
	hasClippingRisk := htmlSizeBytes >= 102400
	if hasClippingRisk {
		issues = append(issues, model.SpamIssue{
			Code:        "GMAIL_102KB_CLIPPING",
			Severity:    "warning",
			Points:      15,
			Description: "HTML body exceeds 102 kB (102,400 bytes).",
			Suggestion:  "Gmail will truncate this message with '[Message clipped] View entire message', breaking layouts and tracking pixels. Minify HTML and inline CSS.",
		})
	}

	// 6. Text-to-Image Ratio Calculation
	textLength := len(strings.TrimSpace(msg.TextBody))
	if textLength == 0 && msg.HTMLBody != "" {
		textLength = len(strings.TrimSpace(htmlStripRegex.ReplaceAllString(msg.HTMLBody, "")))
	}

	imgCount := len(imgTagRegex.FindAllString(msg.HTMLBody, -1))
	textToImageRatio := 100.0

	if imgCount > 0 {
		// Estimate 250 characters of expected text per image
		expectedText := imgCount * 250
		if textLength < expectedText {
			textToImageRatio = (float64(textLength) / float64(expectedText)) * 100.0
			if textToImageRatio < 50.0 {
				issues = append(issues, model.SpamIssue{
					Code:        "LOW_TEXT_IMAGE_RATIO",
					Severity:    "warning",
					Points:      15,
					Description: "Email has a low text-to-image ratio. Image-heavy emails with little copy are commonly flagged by spam filters.",
					Suggestion:  "Add more descriptive textual copy or reduce the number of standalone banners.",
				})
			}
		}
	}

	// Sum deductions
	totalDeductions := 0
	for _, issue := range issues {
		totalDeductions += issue.Points
	}

	finalScore := totalScore - totalDeductions
	if finalScore < 0 {
		finalScore = 0
	}

	verdict := "pass"
	if finalScore < 50 {
		verdict = "fail"
	} else if finalScore < 80 {
		verdict = "warning"
	}

	return model.SpamReport{
		Score:            finalScore,
		Verdict:          verdict,
		TextToImageRatio: textToImageRatio,
		HtmlSizeBytes:    htmlSizeBytes,
		HasClippingRisk:  hasClippingRisk,
		Issues:           issues,
	}
}
