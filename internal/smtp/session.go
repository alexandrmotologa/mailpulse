package smtp

import (
	"context"
	"io"
	"log"

	"github.com/alexandrmotologa/mailpulse/internal/extractor"
	"github.com/alexandrmotologa/mailpulse/internal/linter"
	"github.com/alexandrmotologa/mailpulse/internal/mime"
	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/alexandrmotologa/mailpulse/internal/storage"
	"github.com/alexandrmotologa/mailpulse/internal/webhook"
	"github.com/emersion/go-sasl"
	"github.com/emersion/go-smtp"
)

// Session manages a single SMTP client connection envelope.
type Session struct {
	backend    *Backend
	from       string
	to         []string
	parser     *mime.Parser
	storage    storage.Storage
	dispatcher *webhook.Dispatcher
	onMessage  func(*model.Message)
}

func (s *Session) AuthMechanisms() []string {
	return []string{sasl.Plain, sasl.Login, sasl.Anonymous}
}

func (s *Session) Auth(mech string) (sasl.Server, error) {
	return NewAuthServer(mech)
}

func (s *Session) Mail(from string, opts *smtp.MailOptions) error {
	s.from = from
	return nil
}

func (s *Session) Rcpt(to string, opts *smtp.RcptOptions) error {
	s.to = append(s.to, to)
	return nil
}

func (s *Session) Data(r io.Reader) error {
	// Maybe inject artificial latency or chaos failure
	if s.backend.chaos != nil {
		if err := s.backend.chaos.MaybeInject(); err != nil {
			return err
		}
	}

	// Read with 25 MB safety ceiling
	maxBytes := int64(25 * 1024 * 1024)
	limitReader := io.LimitReader(r, maxBytes)

	raw, err := io.ReadAll(limitReader)
	if err != nil {
		return err
	}

	msg, err := s.parser.Parse(raw)
	if err != nil {
		return err
	}

	// Fallback to envelope addresses if headers were not parsed
	if msg.From.Address == "" || msg.From.Address == "unknown@localhost" {
		if s.from != "" {
			msg.From = model.Address{Address: s.from}
		}
	}
	if len(msg.To) == 0 && len(s.to) > 0 {
		for _, t := range s.to {
			msg.To = append(msg.To, model.Address{Address: t})
		}
	}

	// Run intelligence extractors & linter
	msg.OTP = extractor.ExtractOTP(msg.Subject, msg.TextBody, msg.HTMLBody)
	msg.MagicLinks = extractor.ExtractMagicLinks(msg.TextBody, msg.HTMLBody)
	msg.SpamReport = linter.Evaluate(msg)

	ctx := context.Background()
	if err := s.storage.Save(ctx, msg); err != nil {
		log.Printf("[SMTP] Error persisting message %s: %v", msg.ID, err)
		return err
	}

	log.Printf("[SMTP] Captured email: %q from <%s> to %d recipient(s) [%d bytes]",
		msg.Subject, msg.From.Address, len(msg.To), msg.SizeBytes)

	// Broadcast to real-time subscribers
	if s.onMessage != nil {
		s.onMessage(msg)
	}

	// Trigger webhook forwarding in background
	if s.dispatcher != nil && s.dispatcher.GetDefaultURL() != "" {
		go func(m *model.Message) {
			_, _ = s.dispatcher.Forward(context.Background(), "", m)
		}(msg)
	}

	return nil
}

func (s *Session) Reset() {
	s.from = ""
	s.to = nil
}

func (s *Session) Logout() error {
	return nil
}
