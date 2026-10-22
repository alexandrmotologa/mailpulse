package mime

import (
	"encoding/base64"
	"io"
	"mime/quotedprintable"
	"strings"

	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/google/uuid"
)

// DecodeContent decodes bytes based on Content-Transfer-Encoding.
func DecodeContent(r io.Reader, encoding string) ([]byte, error) {
	encoding = strings.ToLower(strings.TrimSpace(encoding))
	switch encoding {
	case "base64":
		decoder := base64.NewDecoder(base64.StdEncoding, r)
		data, err := io.ReadAll(decoder)
		if err != nil {
			// Try raw read if base64 decoder fails on trailing padding
			return io.ReadAll(r)
		}
		return data, nil
	case "quoted-printable":
		qpReader := quotedprintable.NewReader(r)
		return io.ReadAll(qpReader)
	default: // 7bit, 8bit, binary
		return io.ReadAll(r)
	}
}

// NewAttachment creates an Attachment model with a generated unique ID.
func NewAttachment(filename, contentType, contentID string, data []byte) model.Attachment {
	if filename == "" {
		filename = "attachment"
	}
	return model.Attachment{
		ID:          uuid.New().String(),
		Filename:    filename,
		ContentType: contentType,
		ContentID:   CleanContentID(contentID),
		Size:        int64(len(data)),
		Data:        data,
	}
}
