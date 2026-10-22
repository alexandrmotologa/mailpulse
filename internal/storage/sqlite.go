package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/model"
	_ "modernc.org/sqlite"
)

// SQLiteStore implements persistent storage using modernc.org/sqlite.
type SQLiteStore struct {
	db        *sql.DB
	mu        sync.RWMutex
	startedAt time.Time
	smtpPort  int
	webPort   int
}

// NewSQLiteStore opens or creates an SQLite database at dbPath.
func NewSQLiteStore(dbPath string, smtpPort, webPort int) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	// Optimize SQLite settings for local developer tool throughput
	pragmas := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA foreign_keys = ON;",
		"PRAGMA busy_timeout = 5000;",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			_ = db.Close()
			return nil, err
		}
	}

	schema := `
	CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		received_at DATETIME NOT NULL,
		from_name TEXT,
		from_address TEXT NOT NULL,
		subject TEXT,
		snippet TEXT,
		text_body TEXT,
		html_body TEXT,
		raw_eml BLOB,
		headers_json TEXT,
		to_json TEXT,
		cc_json TEXT,
		bcc_json TEXT,
		reply_to_json TEXT,
		attachments_json TEXT,
		otp_json TEXT,
		magic_links_json TEXT,
		spam_report_json TEXT,
		size_bytes INTEGER,
		is_read INTEGER DEFAULT 0,
		is_starred INTEGER DEFAULT 0
	);

	CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);
	CREATE INDEX IF NOT EXISTS idx_messages_from_addr ON messages(from_address);
	CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
	`

	if _, err := db.Exec(schema); err != nil {
		_ = db.Close()
		return nil, err
	}

	return &SQLiteStore{
		db:        db,
		startedAt: time.Now(),
		smtpPort:  smtpPort,
		webPort:   webPort,
	}, nil
}

func (s *SQLiteStore) Save(ctx context.Context, msg *model.Message) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	headersJSON, _ := json.Marshal(msg.Headers)
	toJSON, _ := json.Marshal(msg.To)
	ccJSON, _ := json.Marshal(msg.Cc)
	bccJSON, _ := json.Marshal(msg.Bcc)
	replyToJSON, _ := json.Marshal(msg.ReplyTo)
	attachmentsJSON, _ := json.Marshal(msg.Attachments)
	otpJSON, _ := json.Marshal(msg.OTP)
	magicLinksJSON, _ := json.Marshal(msg.MagicLinks)
	spamReportJSON, _ := json.Marshal(msg.SpamReport)

	query := `
	INSERT INTO messages (
		id, received_at, from_name, from_address, subject, snippet,
		text_body, html_body, raw_eml, headers_json, to_json, cc_json,
		bcc_json, reply_to_json, attachments_json, otp_json, magic_links_json,
		spam_report_json, size_bytes, is_read, is_starred
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		received_at = excluded.received_at,
		from_name = excluded.from_name,
		from_address = excluded.from_address,
		subject = excluded.subject,
		snippet = excluded.snippet,
		text_body = excluded.text_body,
		html_body = excluded.html_body,
		raw_eml = excluded.raw_eml,
		headers_json = excluded.headers_json,
		to_json = excluded.to_json,
		cc_json = excluded.cc_json,
		bcc_json = excluded.bcc_json,
		reply_to_json = excluded.reply_to_json,
		attachments_json = excluded.attachments_json,
		otp_json = excluded.otp_json,
		magic_links_json = excluded.magic_links_json,
		spam_report_json = excluded.spam_report_json,
		size_bytes = excluded.size_bytes,
		is_read = excluded.is_read,
		is_starred = excluded.is_starred
	;`

	isReadInt := 0
	if msg.IsRead {
		isReadInt = 1
	}
	isStarredInt := 0
	if msg.IsStarred {
		isStarredInt = 1
	}

	_, err := s.db.ExecContext(ctx, query,
		msg.ID, msg.ReceivedAt, msg.From.Name, msg.From.Address, msg.Subject, msg.Snippet,
		msg.TextBody, msg.HTMLBody, msg.RawEML, string(headersJSON), string(toJSON), string(ccJSON),
		string(bccJSON), string(replyToJSON), string(attachmentsJSON), string(otpJSON), string(magicLinksJSON),
		string(spamReportJSON), msg.SizeBytes, isReadInt, isStarredInt,
	)

	return err
}

func (s *SQLiteStore) Get(ctx context.Context, id string) (*model.Message, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `
	SELECT id, received_at, from_name, from_address, subject, snippet,
	       text_body, html_body, raw_eml, headers_json, to_json, cc_json,
	       bcc_json, reply_to_json, attachments_json, otp_json, magic_links_json,
	       spam_report_json, size_bytes, is_read, is_starred
	FROM messages WHERE id = ? LIMIT 1;
	`

	row := s.db.QueryRowContext(ctx, query, id)

	var msg model.Message
	var headersJSON, toJSON, ccJSON, bccJSON, replyToJSON string
	var attachmentsJSON, otpJSON, magicLinksJSON, spamReportJSON string
	var isReadInt, isStarredInt int

	err := row.Scan(
		&msg.ID, &msg.ReceivedAt, &msg.From.Name, &msg.From.Address, &msg.Subject, &msg.Snippet,
		&msg.TextBody, &msg.HTMLBody, &msg.RawEML, &headersJSON, &toJSON, &ccJSON,
		&bccJSON, &replyToJSON, &attachmentsJSON, &otpJSON, &magicLinksJSON,
		&spamReportJSON, &msg.SizeBytes, &isReadInt, &isStarredInt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	msg.IsRead = isReadInt == 1
	msg.IsStarred = isStarredInt == 1

	_ = json.Unmarshal([]byte(headersJSON), &msg.Headers)
	_ = json.Unmarshal([]byte(toJSON), &msg.To)
	_ = json.Unmarshal([]byte(ccJSON), &msg.Cc)
	_ = json.Unmarshal([]byte(bccJSON), &msg.Bcc)
	_ = json.Unmarshal([]byte(replyToJSON), &msg.ReplyTo)
	_ = json.Unmarshal([]byte(attachmentsJSON), &msg.Attachments)
	_ = json.Unmarshal([]byte(otpJSON), &msg.OTP)
	_ = json.Unmarshal([]byte(magicLinksJSON), &msg.MagicLinks)
	_ = json.Unmarshal([]byte(spamReportJSON), &msg.SpamReport)

	return &msg, nil
}

func (s *SQLiteStore) List(ctx context.Context, query string, tag string, limit, offset int) ([]model.MessageSummary, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	whereClauses := []string{"1=1"}
	args := []interface{}{}

	q := strings.TrimSpace(query)
	if q != "" {
		likeQ := "%" + strings.ToLower(q) + "%"
		whereClauses = append(whereClauses, "(LOWER(subject) LIKE ? OR LOWER(from_address) LIKE ? OR LOWER(from_name) LIKE ? OR LOWER(snippet) LIKE ?)")
		args = append(args, likeQ, likeQ, likeQ, likeQ)
	}

	switch tag {
	case "otp":
		whereClauses = append(whereClauses, "otp_json IS NOT NULL AND otp_json != 'null' AND otp_json != '{}'")
	case "unread":
		whereClauses = append(whereClauses, "is_read = 0")
	case "starred":
		whereClauses = append(whereClauses, "is_starred = 1")
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Count total
	countQuery := "SELECT COUNT(*) FROM messages WHERE " + whereSQL
	var total int
	if err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	selectSQL := `
	SELECT id, received_at, from_name, from_address, subject, snippet,
	       html_body, text_body, attachments_json, otp_json, spam_report_json,
	       size_bytes, is_read, is_starred, to_json
	FROM messages
	WHERE ` + whereSQL + `
	ORDER BY received_at DESC
	LIMIT ? OFFSET ?;
	`
	selectArgs := append(args, limit, offset)

	rows, err := s.db.QueryContext(ctx, selectSQL, selectArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	summaries := make([]model.MessageSummary, 0)
	for rows.Next() {
		var id, fromName, fromAddr, subject, snippet, htmlBody, textBody string
		var attachmentsJSON, otpJSON, spamReportJSON, toJSON string
		var receivedAt time.Time
		var sizeBytes int64
		var isReadInt, isStarredInt int

		err := rows.Scan(
			&id, &receivedAt, &fromName, &fromAddr, &subject, &snippet,
			&htmlBody, &textBody, &attachmentsJSON, &otpJSON, &spamReportJSON,
			&sizeBytes, &isReadInt, &isStarredInt, &toJSON,
		)
		if err != nil {
			return nil, 0, err
		}

		var toList []model.Address
		_ = json.Unmarshal([]byte(toJSON), &toList)

		var attachments []model.Attachment
		_ = json.Unmarshal([]byte(attachmentsJSON), &attachments)

		var otp *model.OTPInfo
		_ = json.Unmarshal([]byte(otpJSON), &otp)

		var spamReport model.SpamReport
		_ = json.Unmarshal([]byte(spamReportJSON), &spamReport)

		otpCode := ""
		if otp != nil {
			otpCode = otp.Code
		}

		// Filter for tags that require post-parsing if needed
		if tag == "flagged" && spamReport.Verdict != "fail" && spamReport.Verdict != "warning" {
			continue
		}
		if tag == "has_attachment" && len(attachments) == 0 {
			continue
		}

		summaries = append(summaries, model.MessageSummary{
			ID:              id,
			ReceivedAt:      receivedAt,
			From:            model.Address{Name: fromName, Address: fromAddr},
			To:              toList,
			Subject:         subject,
			Snippet:         snippet,
			HasHTML:         len(htmlBody) > 0,
			HasText:         len(textBody) > 0,
			AttachmentCount: len(attachments),
			OTPCode:         otpCode,
			SpamScore:       spamReport.Score,
			SpamVerdict:     spamReport.Verdict,
			SizeBytes:       sizeBytes,
			IsRead:          isReadInt == 1,
			IsStarred:       isStarredInt == 1,
		})
	}

	return summaries, total, nil
}

func (s *SQLiteStore) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	res, err := s.db.ExecContext(ctx, "DELETE FROM messages WHERE id = ?", id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *SQLiteStore) Clear(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.ExecContext(ctx, "DELETE FROM messages;")
	return err
}

func (s *SQLiteStore) MarkRead(ctx context.Context, id string, isRead bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	val := 0
	if isRead {
		val = 1
	}
	res, err := s.db.ExecContext(ctx, "UPDATE messages SET is_read = ? WHERE id = ?", val, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *SQLiteStore) MarkStarred(ctx context.Context, id string, isStarred bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	val := 0
	if isStarred {
		val = 1
	}
	res, err := s.db.ExecContext(ctx, "UPDATE messages SET is_starred = ? WHERE id = ?", val, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *SQLiteStore) GetStats(ctx context.Context) (model.ServerStats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var total, unread int
	_ = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM messages").Scan(&total)
	_ = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM messages WHERE is_read = 0").Scan(&unread)

	var otpCount int
	_ = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM messages WHERE otp_json IS NOT NULL AND otp_json != 'null' AND otp_json != '{}'").Scan(&otpCount)

	return model.ServerStats{
		TotalMessages:    total,
		UnreadCount:      unread,
		OTPCount:         otpCount,
		FlaggedSpamCount: 0,
		SMTPPort:         s.smtpPort,
		WebPort:          s.webPort,
		StorageType:      "sqlite",
		UptimeSeconds:    int64(time.Since(s.startedAt).Seconds()),
		StartedAt:        s.startedAt,
	}, nil
}

func (s *SQLiteStore) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.Close()
}
