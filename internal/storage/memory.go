package storage

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

// MemoryStore implements an in-memory ring buffer for emails.
type MemoryStore struct {
	mu          sync.RWMutex
	messages    []*model.Message
	index       map[string]*model.Message
	maxMessages int
	startedAt   time.Time
	smtpPort    int
	webPort     int
}

// NewMemoryStore initializes a memory-backed store.
func NewMemoryStore(maxMessages, smtpPort, webPort int) *MemoryStore {
	if maxMessages <= 0 {
		maxMessages = 500
	}
	return &MemoryStore{
		messages:    make([]*model.Message, 0, maxMessages),
		index:       make(map[string]*model.Message),
		maxMessages: maxMessages,
		startedAt:   time.Now(),
		smtpPort:    smtpPort,
		webPort:     webPort,
	}
}

func (s *MemoryStore) Save(ctx context.Context, msg *model.Message) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// If message already exists, update it
	if existing, ok := s.index[msg.ID]; ok {
		*existing = *msg
		return nil
	}

	// If at capacity, remove the oldest message
	if len(s.messages) >= s.maxMessages {
		oldest := s.messages[0]
		delete(s.index, oldest.ID)
		s.messages = s.messages[1:]
	}

	s.messages = append(s.messages, msg)
	s.index[msg.ID] = msg
	return nil
}

func (s *MemoryStore) Get(ctx context.Context, id string) (*model.Message, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	msg, ok := s.index[id]
	if !ok {
		return nil, ErrNotFound
	}
	return msg, nil
}

func (s *MemoryStore) List(ctx context.Context, query string, tag string, limit, offset int) ([]model.MessageSummary, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	q := strings.ToLower(strings.TrimSpace(query))
	filtered := make([]*model.Message, 0, len(s.messages))

	// Iterate in reverse (newest first)
	for i := len(s.messages) - 1; i >= 0; i-- {
		msg := s.messages[i]

		// Query search filter
		if q != "" {
			matchSubject := strings.Contains(strings.ToLower(msg.Subject), q)
			matchFrom := strings.Contains(strings.ToLower(msg.From.Address), q) || strings.Contains(strings.ToLower(msg.From.Name), q)
			matchSnippet := strings.Contains(strings.ToLower(msg.Snippet), q)
			matchTo := false
			for _, to := range msg.To {
				if strings.Contains(strings.ToLower(to.Address), q) || strings.Contains(strings.ToLower(to.Name), q) {
					matchTo = true
					break
				}
			}
			if !matchSubject && !matchFrom && !matchSnippet && !matchTo {
				continue
			}
		}

		// Tag filter
		if tag != "" {
			switch tag {
			case "otp":
				if msg.OTP == nil || msg.OTP.Code == "" {
					continue
				}
			case "flagged":
				if msg.SpamReport.Verdict != "fail" && msg.SpamReport.Verdict != "warning" {
					continue
				}
			case "has_attachment":
				if len(mAttachmentFilter(msg)) == 0 {
					continue
				}
			case "unread":
				if msg.IsRead {
					continue
				}
			case "starred":
				if !msg.IsStarred {
					continue
				}
			}
		}

		filtered = append(filtered, msg)
	}

	total := len(filtered)
	if offset < 0 {
		offset = 0
	}
	if offset >= total {
		return []model.MessageSummary{}, total, nil
	}

	end := offset + limit
	if limit <= 0 || end > total {
		end = total
	}

	results := make([]model.MessageSummary, 0, end-offset)
	for _, m := range filtered[offset:end] {
		results = append(results, m.ToSummary())
	}

	return results, total, nil
}

func mAttachmentFilter(msg *model.Message) []model.Attachment {
	var nonInline []model.Attachment
	for _, a := range msg.Attachments {
		if a.ContentID == "" {
			nonInline = append(nonInline, a)
		}
	}
	return nonInline
}

func (s *MemoryStore) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.index[id]; !ok {
		return ErrNotFound
	}

	delete(s.index, id)
	for i, msg := range s.messages {
		if msg.ID == id {
			s.messages = append(s.messages[:i], s.messages[i+1:]...)
			break
		}
	}
	return nil
}

func (s *MemoryStore) Clear(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.messages = make([]*model.Message, 0, s.maxMessages)
	s.index = make(map[string]*model.Message)
	return nil
}

func (s *MemoryStore) MarkRead(ctx context.Context, id string, isRead bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	msg, ok := s.index[id]
	if !ok {
		return ErrNotFound
	}
	msg.IsRead = isRead
	return nil
}

func (s *MemoryStore) MarkStarred(ctx context.Context, id string, isStarred bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	msg, ok := s.index[id]
	if !ok {
		return ErrNotFound
	}
	msg.IsStarred = isStarred
	return nil
}

func (s *MemoryStore) GetStats(ctx context.Context) (model.ServerStats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	total := len(s.messages)
	unread := 0
	otpCount := 0
	flagged := 0

	for _, msg := range s.messages {
		if !msg.IsRead {
			unread++
		}
		if msg.OTP != nil && msg.OTP.Code != "" {
			otpCount++
		}
		if msg.SpamReport.Verdict == "fail" || msg.SpamReport.Verdict == "warning" {
			flagged++
		}
	}

	return model.ServerStats{
		TotalMessages:    total,
		UnreadCount:      unread,
		OTPCount:         otpCount,
		FlaggedSpamCount: flagged,
		SMTPPort:         s.smtpPort,
		WebPort:          s.webPort,
		StorageType:      "memory",
		UptimeSeconds:    int64(time.Since(s.startedAt).Seconds()),
		StartedAt:        s.startedAt,
	}, nil
}

func (s *MemoryStore) Close() error {
	return nil
}
