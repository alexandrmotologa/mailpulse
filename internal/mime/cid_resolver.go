package mime

import (
	"encoding/base64"
	"fmt"
	"regexp"
	"strings"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

var (
	cidTagRegex = regexp.MustCompile(`(?i)(src|background)\s*=\s*['"]\s*cid:([^'"]+)\s*['"]`)
	cidCSSRegex = regexp.MustCompile(`(?i)url\(\s*['"]?\s*cid:([^'")]+)\s*['"]?\s*\)`)
)

// CleanContentID normalizes Content-ID headers by stripping angle brackets and spaces.
func CleanContentID(id string) string {
	id = strings.TrimSpace(id)
	id = strings.TrimPrefix(id, "<")
	id = strings.TrimSuffix(id, ">")
	return strings.TrimSpace(id)
}

// ResolveInlineCIDImages replaces inline cid: references in HTML with base64 data URIs.
func ResolveInlineCIDImages(html string, attachments []model.Attachment) string {
	if len(attachments) == 0 || !strings.Contains(html, "cid:") {
		return html
	}

	// Build map of Content-ID -> Data URI
	cidMap := make(map[string]string)
	for _, att := range attachments {
		cleanID := CleanContentID(att.ContentID)
		if cleanID == "" && att.Filename != "" {
			cleanID = att.Filename
		}
		if cleanID != "" && len(att.Data) > 0 {
			contentType := att.ContentType
			if contentType == "" {
				contentType = "image/png"
			}
			encoded := base64.StdEncoding.EncodeToString(att.Data)
			dataURI := fmt.Sprintf("data:%s;base64,%s", contentType, encoded)
			cidMap[cleanID] = dataURI
			cidMap[strings.ToLower(cleanID)] = dataURI
		}
	}

	// Replace HTML src="cid:..." and background="cid:..."
	result := cidTagRegex.ReplaceAllStringFunc(html, func(match string) string {
		submatches := cidTagRegex.FindStringSubmatch(match)
		if len(submatches) < 3 {
			return match
		}
		attr := submatches[1]
		cidRef := CleanContentID(submatches[2])

		if dataURI, found := cidMap[cidRef]; found {
			return fmt.Sprintf(`%s="%s"`, attr, dataURI)
		}
		if dataURI, found := cidMap[strings.ToLower(cidRef)]; found {
			return fmt.Sprintf(`%s="%s"`, attr, dataURI)
		}
		return match
	})

	// Replace CSS url('cid:...')
	result = cidCSSRegex.ReplaceAllStringFunc(result, func(match string) string {
		submatches := cidCSSRegex.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match
		}
		cidRef := CleanContentID(submatches[1])

		if dataURI, found := cidMap[cidRef]; found {
			return fmt.Sprintf(`url("%s")`, dataURI)
		}
		if dataURI, found := cidMap[strings.ToLower(cidRef)]; found {
			return fmt.Sprintf(`url("%s")`, dataURI)
		}
		return match
	})

	return result
}
