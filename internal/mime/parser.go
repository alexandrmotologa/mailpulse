package mime

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/google/uuid"
)

var (
	htmlTagRegex = regexp.MustCompile(`<[^>]*>`)
	spaceRegex   = regexp.MustCompile(`\s+`)
)

// Parser parses RFC 5322 raw messages into model.Message.
type Parser struct {
	wordDecoder *mime.WordDecoder
}

// NewParser creates a new MIME parser instance.
func NewParser() *Parser {
	return &Parser{
		wordDecoder: &mime.WordDecoder{},
	}
}

// Parse extracts structured data from an RFC 5322 byte stream.
func (p *Parser) Parse(raw []byte) (*model.Message, error) {
	if len(raw) == 0 {
		return nil, errors.New("empty message payload")
	}

	reader := bytes.NewReader(raw)
	parsedMail, err := mail.ReadMessage(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to parse RFC 5322 message: %w", err)
	}

	id := uuid.New().String()
	receivedAt := time.Now().UTC()

	// Parse date header if available
	if dateStr := parsedMail.Header.Get("Date"); dateStr != "" {
		if t, err := mail.ParseDate(dateStr); err == nil {
			receivedAt = t
		}
	}

	// Parse Subject
	rawSubject := parsedMail.Header.Get("Subject")
	subject, _ := p.decodeHeader(rawSubject)

	// Parse Addresses
	from := p.parseSingleAddress(parsedMail.Header.Get("From"))
	to := p.parseAddressList(parsedMail.Header.Get("To"))
	cc := p.parseAddressList(parsedMail.Header.Get("Cc"))
	bcc := p.parseAddressList(parsedMail.Header.Get("Bcc"))
	replyTo := p.parseAddressList(parsedMail.Header.Get("Reply-To"))

	// Extract Headers map
	headers := make(map[string][]string)
	for key, values := range parsedMail.Header {
		decodedValues := make([]string, len(values))
		for i, v := range values {
			dec, _ := p.decodeHeader(v)
			decodedValues[i] = dec
		}
		headers[key] = decodedValues
	}

	contentType := parsedMail.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "text/plain; charset=utf-8"
	}

	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		mediaType = "text/plain"
		params = map[string]string{"charset": "utf-8"}
	}

	var textBody strings.Builder
	var htmlBody strings.Builder
	attachments := make([]model.Attachment, 0)

	transferEncoding := parsedMail.Header.Get("Content-Transfer-Encoding")

	if strings.HasPrefix(mediaType, "multipart/") {
		boundary := params["boundary"]
		if boundary != "" {
			p.parseMultipart(parsedMail.Body, boundary, &textBody, &htmlBody, &attachments)
		}
	} else if strings.EqualFold(mediaType, "text/html") {
		decoded, err := DecodeContent(parsedMail.Body, transferEncoding)
		if err == nil {
			htmlBody.Write(decoded)
		}
	} else {
		// Default to text/plain or binary
		decoded, err := DecodeContent(parsedMail.Body, transferEncoding)
		if err == nil {
			textBody.Write(decoded)
		}
	}

	rawHtml := htmlBody.String()
	sanitizedHtml := SanitizeHTML(rawHtml)
	resolvedHtml := ResolveInlineCIDImages(sanitizedHtml, attachments)

	plainText := textBody.String()
	snippet := p.generateSnippet(plainText, rawHtml)

	msg := &model.Message{
		ID:          id,
		ReceivedAt:  receivedAt,
		From:        from,
		To:          to,
		Cc:          cc,
		Bcc:         bcc,
		ReplyTo:     replyTo,
		Subject:     subject,
		Snippet:     snippet,
		TextBody:    plainText,
		HTMLBody:    resolvedHtml,
		RawEML:      raw,
		Headers:     headers,
		Attachments: attachments,
		MagicLinks:  make([]model.MagicLink, 0),
		SizeBytes:   int64(len(raw)),
		IsRead:      false,
		IsStarred:   false,
	}

	return msg, nil
}

func (p *Parser) parseMultipart(r io.Reader, boundary string, textBody, htmlBody *strings.Builder, attachments *[]model.Attachment) {
	mr := multipart.NewReader(r, boundary)
	for {
		part, err := mr.NextPart()
		if err != nil {
			break
		}

		partHeader := part.Header
		partContentType := partHeader.Get("Content-Type")
		if partContentType == "" {
			partContentType = "text/plain"
		}

		pMediaType, pParams, err := mime.ParseMediaType(partContentType)
		if err != nil {
			pMediaType = "application/octet-stream"
		}

		transferEncoding := partHeader.Get("Content-Transfer-Encoding")
		contentDisposition := partHeader.Get("Content-Disposition")
		dispType, dispParams, _ := mime.ParseMediaType(contentDisposition)
		contentID := partHeader.Get("Content-ID")

		filename := dispParams["filename"]
		if filename == "" {
			filename = pParams["name"]
		}
		if filename != "" {
			filename, _ = p.decodeHeader(filename)
		}

		// If this subpart is itself a multipart, recurse!
		if strings.HasPrefix(pMediaType, "multipart/") {
			subBoundary := pParams["boundary"]
			if subBoundary != "" {
				p.parseMultipart(part, subBoundary, textBody, htmlBody, attachments)
			}
			continue
		}

		decodedBytes, err := DecodeContent(part, transferEncoding)
		if err != nil {
			continue
		}

		isAttachment := strings.EqualFold(dispType, "attachment") || filename != "" || contentID != ""

		if isAttachment {
			att := NewAttachment(filename, pMediaType, contentID, decodedBytes)
			*attachments = append(*attachments, att)
		} else if strings.EqualFold(pMediaType, "text/html") {
			htmlBody.Write(decodedBytes)
		} else if strings.EqualFold(pMediaType, "text/plain") {
			textBody.Write(decodedBytes)
		} else {
			// Unnamed inline or other part, treat as attachment if non-empty
			if len(decodedBytes) > 0 {
				att := NewAttachment(filename, pMediaType, contentID, decodedBytes)
				*attachments = append(*attachments, att)
			}
		}
	}
}

func (p *Parser) decodeHeader(header string) (string, error) {
	if header == "" {
		return "", nil
	}
	dec, err := p.wordDecoder.DecodeHeader(header)
	if err != nil {
		return header, nil
	}
	return dec, nil
}

func (p *Parser) parseSingleAddress(addrStr string) model.Address {
	if addrStr == "" {
		return model.Address{Address: "unknown@localhost"}
	}
	addr, err := mail.ParseAddress(addrStr)
	if err != nil {
		name, _ := p.decodeHeader(addrStr)
		return model.Address{Name: name, Address: addrStr}
	}
	name, _ := p.decodeHeader(addr.Name)
	return model.Address{Name: name, Address: addr.Address}
}

func (p *Parser) parseAddressList(addrListStr string) []model.Address {
	if strings.TrimSpace(addrListStr) == "" {
		return []model.Address{}
	}
	list, err := mail.ParseAddressList(addrListStr)
	if err != nil {
		// Fallback split by comma
		parts := strings.Split(addrListStr, ",")
		var addrs []model.Address
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				addrs = append(addrs, p.parseSingleAddress(trimmed))
			}
		}
		return addrs
	}
	var addrs []model.Address
	for _, a := range list {
		name, _ := p.decodeHeader(a.Name)
		addrs = append(addrs, model.Address{Name: name, Address: a.Address})
	}
	return addrs
}

func (p *Parser) generateSnippet(text, html string) string {
	raw := text
	if strings.TrimSpace(raw) == "" && strings.TrimSpace(html) != "" {
		raw = htmlTagRegex.ReplaceAllString(html, " ")
	}
	cleaned := spaceRegex.ReplaceAllString(raw, " ")
	cleaned = strings.TrimSpace(cleaned)

	if len(cleaned) > 160 {
		return cleaned[:157] + "..."
	}
	return cleaned
}
