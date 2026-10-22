package storage

import (
	"context"
	"errors"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

var (
	ErrNotFound = errors.New("message not found")
)

// Storage defines the interface for persisting and querying captured emails.
type Storage interface {
	Save(ctx context.Context, msg *model.Message) error
	Get(ctx context.Context, id string) (*model.Message, error)
	List(ctx context.Context, query string, tag string, limit, offset int) ([]model.MessageSummary, int, error)
	Delete(ctx context.Context, id string) error
	Clear(ctx context.Context) error
	MarkRead(ctx context.Context, id string, isRead bool) error
	MarkStarred(ctx context.Context, id string, isStarred bool) error
	GetStats(ctx context.Context) (model.ServerStats, error)
	Close() error
}
