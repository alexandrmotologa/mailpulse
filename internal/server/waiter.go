package server

import (
	"strings"
	"sync"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

// WaitRequest represents an outstanding long-polling request waiting for an email.
type WaitRequest struct {
	To      string
	From    string
	Subject string
	Query   string
	Ch      chan *model.Message
}

func (r *WaitRequest) matches(msg *model.Message) bool {
	if r.To != "" {
		target := strings.ToLower(r.To)
		matched := false
		for _, to := range msg.To {
			if strings.Contains(strings.ToLower(to.Address), target) || strings.Contains(strings.ToLower(to.Name), target) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	if r.From != "" {
		target := strings.ToLower(r.From)
		if !strings.Contains(strings.ToLower(msg.From.Address), target) && !strings.Contains(strings.ToLower(msg.From.Name), target) {
			return false
		}
	}

	if r.Subject != "" {
		if !strings.Contains(strings.ToLower(msg.Subject), strings.ToLower(r.Subject)) {
			return false
		}
	}

	if r.Query != "" {
		q := strings.ToLower(r.Query)
		hasQuery := strings.Contains(strings.ToLower(msg.Subject), q) ||
			strings.Contains(strings.ToLower(msg.TextBody), q) ||
			strings.Contains(strings.ToLower(msg.Snippet), q)
		if !hasQuery {
			return false
		}
	}

	return true
}

// WaiterRegistry tracks active long-polling clients.
type WaiterRegistry struct {
	mu      sync.Mutex
	waiters map[*WaitRequest]struct{}
}

// NewWaiterRegistry creates a waiter registry.
func NewWaiterRegistry() *WaiterRegistry {
	return &WaiterRegistry{
		waiters: make(map[*WaitRequest]struct{}),
	}
}

// Register adds a wait request to the registry.
func (wr *WaiterRegistry) Register(req *WaitRequest) {
	wr.mu.Lock()
	defer wr.mu.Unlock()
	wr.waiters[req] = struct{}{}
}

// Unregister removes a wait request.
func (wr *WaiterRegistry) Unregister(req *WaitRequest) {
	wr.mu.Lock()
	defer wr.mu.Unlock()
	delete(wr.waiters, req)
}

// Notify checks all active waiters and delivers the message to matching requests.
func (wr *WaiterRegistry) Notify(msg *model.Message) {
	wr.mu.Lock()
	defer wr.mu.Unlock()

	for req := range wr.waiters {
		if req.matches(msg) {
			select {
			case req.Ch <- msg:
			default:
			}
		}
	}
}
