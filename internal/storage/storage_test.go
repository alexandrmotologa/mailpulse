package storage

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/model"
)

func createTestMessage(id string, subject string, otpCode string) *model.Message {
	var otp *model.OTPInfo
	if otpCode != "" {
		otp = &model.OTPInfo{
			Code:    otpCode,
			Type:    "numeric_6",
			Context: "verification code",
		}
	}
	return &model.Message{
		ID:         id,
		ReceivedAt: time.Now(),
		From:       model.Address{Name: "Acme", Address: "noreply@example.com"},
		To:         []model.Address{{Name: "Developer", Address: "dev@example.com"}},
		Subject:    subject,
		Snippet:    "Snippet for " + subject,
		TextBody:   "Hello from " + subject,
		HTMLBody:   "<p>Hello from " + subject + "</p>",
		OTP:        otp,
		SpamReport: model.SpamReport{
			Score:   95,
			Verdict: "pass",
		},
		SizeBytes: 1024,
	}
}

func testStoreImplementation(t *testing.T, store Storage) {
	ctx := context.Background()

	// 1. Save and Get
	msg1 := createTestMessage("msg-1", "Welcome to Acme", "123456")
	msg2 := createTestMessage("msg-2", "Password Reset", "")
	msg3 := createTestMessage("msg-3", "Your Receipt", "998877")

	if err := store.Save(ctx, msg1); err != nil {
		t.Fatalf("failed to save msg1: %v", err)
	}
	if err := store.Save(ctx, msg2); err != nil {
		t.Fatalf("failed to save msg2: %v", err)
	}
	if err := store.Save(ctx, msg3); err != nil {
		t.Fatalf("failed to save msg3: %v", err)
	}

	fetched, err := store.Get(ctx, "msg-1")
	if err != nil {
		t.Fatalf("failed to get msg1: %v", err)
	}
	if fetched.Subject != "Welcome to Acme" {
		t.Errorf("expected subject 'Welcome to Acme', got '%s'", fetched.Subject)
	}
	if fetched.OTP == nil || fetched.OTP.Code != "123456" {
		t.Errorf("expected OTP 123456, got %+v", fetched.OTP)
	}

	// 2. List all
	list, total, err := store.List(ctx, "", "", 10, 0)
	if err != nil {
		t.Fatalf("failed to list messages: %v", err)
	}
	if total != 3 {
		t.Errorf("expected total 3, got %d", total)
	}
	if len(list) != 3 {
		t.Errorf("expected 3 items in list, got %d", len(list))
	}

	// 3. Search query
	listQ, totalQ, err := store.List(ctx, "receipt", "", 10, 0)
	if err != nil {
		t.Fatalf("failed to search: %v", err)
	}
	if totalQ != 1 || len(listQ) != 1 || listQ[0].ID != "msg-3" {
		t.Errorf("expected 1 result with msg-3, got %d", totalQ)
	}

	// 4. Tag filter for OTP
	listOTP, totalOTP, err := store.List(ctx, "", "otp", 10, 0)
	if err != nil {
		t.Fatalf("failed to filter by otp: %v", err)
	}
	if totalOTP != 2 || len(listOTP) != 2 {
		t.Errorf("expected 2 OTP messages, got total=%d len=%d", totalOTP, len(listOTP))
	}

	// 5. Mark read & starred
	if err := store.MarkRead(ctx, "msg-1", true); err != nil {
		t.Fatalf("failed to mark read: %v", err)
	}
	if err := store.MarkStarred(ctx, "msg-1", true); err != nil {
		t.Fatalf("failed to mark starred: %v", err)
	}
	upd, _ := store.Get(ctx, "msg-1")
	if !upd.IsRead || !upd.IsStarred {
		t.Errorf("expected isRead=true and isStarred=true")
	}

	// 6. Delete
	if err := store.Delete(ctx, "msg-2"); err != nil {
		t.Fatalf("failed to delete msg-2: %v", err)
	}
	_, err = store.Get(ctx, "msg-2")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound for deleted msg, got %v", err)
	}

	// 7. Clear
	if err := store.Clear(ctx); err != nil {
		t.Fatalf("failed to clear store: %v", err)
	}
	_, totalAfter, _ := store.List(ctx, "", "", 10, 0)
	if totalAfter != 0 {
		t.Errorf("expected 0 messages after clear, got %d", totalAfter)
	}
}

func TestMemoryStore(t *testing.T) {
	memStore := NewMemoryStore(10, 1025, 8025)
	testStoreImplementation(t, memStore)
}

func TestSQLiteStore(t *testing.T) {
	dbPath := "test_mailpulse.db"
	defer os.Remove(dbPath)

	sqlStore, err := NewSQLiteStore(dbPath, 1025, 8025)
	if err != nil {
		t.Fatalf("failed to init SQLiteStore: %v", err)
	}
	defer sqlStore.Close()

	testStoreImplementation(t, sqlStore)
}
