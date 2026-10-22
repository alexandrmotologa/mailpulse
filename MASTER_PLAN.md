# MailPulse: Master Implementation Plan

Local SMTP capture server, responsive HTML email previewer, and deliverability linter in Go 1.23 and React 19.

---

## 1. Executive Summary

MailPulse solves the common friction points of transactional email development:
- Intercepts outgoing SMTP traffic locally on `127.0.0.1:1025` without external cloud accounts or sandbox quotas.
- Renders HTML emails in an isolated sandbox with viewports for Desktop, Tablet, Mobile, and Synchronized Dual View.
- Emulates light and dark color schemes, including dark-mode email client color transformations.
- Extracts one-time passcodes (OTP) and magic authentication links for one-click developer copying.
- Audits deliverability with a spam score heuristics engine (text-to-image ratio, subject line capitalization, missing headers, Gmail 102 kB size truncation limits).
- Provides blocking wait endpoints for Playwright, Cypress, Pytest, and CI end-to-end test suites.
- Injects artificial latency and simulated SMTP error codes (421, 450, 550) for resilience chaos testing.
- Dispatches received emails to local webhook endpoints for end-to-end integration testing.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------------------+
|                                     MAILPULSE                                     |
+-----------------------------------------+-----------------------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                                                   |
+-------v-------------------------+                 +-----------------------v-------+
|    Local SMTP Daemon (:1025)    |                 |      MIME & HTML Parser       |
|  * RFC 5321 Ingestion           |                 |  * Multipart/Alternative      |
|  * STARTTLS with Self-Signed    |                 |  * Inline CID Image Resolver  |
|  * Dev Auth (Accepts Any Creds) |                 |  * Quoted-Printable & Base64  |
|  * Chaos & Latency Simulator    |                 |  * Script & Tracker Stripper  |
+-------+-------------------------+                 +-----------------------+-------+
        |                                                                   |
        +---------------------------------+---------------------------------+
                                          |
                        +-----------------v-----------------+
                        |    OTP & Magic Link Extractor     |
                        |  * Regex Pattern Recognizer       |
                        |  * 1-Click Copyable OTP Pills     |
                        |  * Auth Token Parameter Inspector |
                        |  * Concurrent HTTP Link Prober    |
                        +-----------------+-----------------+
                                          |
                        +-----------------v-----------------+
                        |   Spam & Deliverability Linter    |
                        |  * Text-to-Image Ratio            |
                        |  * Missing Headers Audit          |
                        |  * Gmail 102 kB Clipping Warning  |
                        |  * Insecure HTTP Link Checker     |
                        +-----------------+-----------------+
                                          |
                        +-----------------v-----------------+
                        |   Storage & Event Dispatcher      |
                        |  * In-Memory Ring Buffer (500)    |
                        |  * Persistent SQLite Backend      |
                        |  * Real-Time SSE Event Stream     |
                        |  * Long-Polling Waiter Registry   |
                        |  * Local Webhook Forwarder        |
                        +-----------------+-----------------+
                                          |
                        +-----------------v-----------------+
                        |   Interactive Web Studio (:8025)  |
                        |  * Responsive Viewport Sandbox    |
                        |  * Dual View with Sync Scrolling  |
                        |  * Superhuman Keyboard Shortcuts  |
                        |  * Standalone HTML & ZIP Exporter |
                        |  * E2E Code Recipe Generator      |
                        +-----------------------------------+
```

---

## 3. Directory Layout

```
mailpulse/
├── cmd/
│   └── mailpulse/
│       └── main.go                 # Application entrypoint & CLI flag parser
├── internal/
│   ├── model/
│   │   └── message.go              # Core domain models (Email, Attachment, SpamReport, OTP)
│   ├── smtp/
│   │   ├── server.go               # RFC 5321 server listening on :1025
│   │   ├── session.go              # SMTP session lifecycle & envelope capture
│   │   ├── auth.go                 # Authentication handler (PLAIN/LOGIN bypass)
│   │   └── chaos.go                # Chaos simulator for artificial latency & errors
│   ├── mime/
│   │   ├── parser.go               # RFC 5322 multipart message decoder
│   │   ├── cid_resolver.go         # Inlines cid: image references into data URIs
│   │   ├── sanitizer.go            # HTML safety sanitizer
│   │   └── attachments.go          # Binary & file attachment decoder
│   ├── extractor/
│   │   ├── otp.go                  # 4 to 8 digit OTP & alphanumeric token extractor
│   │   └── magic_links.go          # Auth link & query parameter extractor
│   ├── linter/
│   │   ├── spam_rules.go           # Rule-based deliverability scorer (0-100)
│   │   ├── headers_check.go        # RFC header compliance checker
│   │   ├── link_checker.go         # Security and link protocol validator
│   │   └── prober.go               # Active concurrent HTTP link health prober
│   ├── storage/
│   │   ├── storage.go              # Storage interface
│   │   ├── memory.go               # Circular ring buffer in-memory store
│   │   └── sqlite.go               # SQLite storage engine with migrations
│   ├── webhook/
│   │   └── dispatcher.go           # Outgoing HTTP webhook forwarder with logs
│   ├── sample/
│   │   └── generator.go            # Sample email generator (OTP, invoice, spam, alert)
│   └── server/
│       ├── api.go                  # REST API handlers
│       ├── sse.go                  # Server-Sent Events broker
│       ├── waiter.go               # Long-polling waiter registry for CI/CD test sync
│       ├── export.go               # Standalone portable HTML and ZIP exporter
│       ├── static.go               # Embedded React 19 web assets
│       └── web_dist/               # Compiled React production assets
├── web/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── types/
│       │   └── index.ts
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── MessageList.tsx
│       │   ├── MessageDetail.tsx
│       │   ├── DeviceFrame.tsx
│       │   ├── OtpBanner.tsx
│       │   ├── SpamAuditScore.tsx
│       │   ├── RawMimeDrawer.tsx
│       │   ├── WebhookModal.tsx
│       │   ├── E2ESnippetsModal.tsx
│       │   ├── ChaosModal.tsx
│       │   └── ShortcutsModal.tsx
│       └── hooks/
│           └── useMailStream.ts
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── smtp-guide.md
│   └── images/
│       ├── mailpulse-1.png
│       ├── mailpulse-2.png
│       ├── mailpulse-3.png
│       ├── mailpulse-4.png
│       └── mailpulse_demo.gif
├── go.mod
├── go.sum
├── LICENSE
└── README.md
```

---

## 4. Detailed Tasks & Subtasks

### Task 1: Repository Foundation & Documentation Setup
- [x] 1.1 Initialize Git repository and create public GitHub repo `alexandrmotologa/mailpulse`.
- [x] 1.2 Couple GitHub description with 14 topics across 4 dimensions.
- [x] 1.3 Register project in MTLG portfolio ecosystem (`mtlg.site` and `mtlglabs.space`) under dev badge.
- [x] 1.4 Create `LICENSE` (MIT) and humanized documentation files (`README.md`, `docs/architecture.md`, `docs/api.md`, `docs/smtp-guide.md`).

### Task 2: Go Backend Architecture & Domain Models
- [x] 2.1 Initialize Go 1.23 module `github.com/alexandrmotologa/mailpulse`.
- [x] 2.2 Define domain types in `internal/model/message.go`:
  - `Message`, `Address`, `Attachment`, `SpamReport`, `SpamIssue`, `OTPInfo`, `MagicLink`, `WebhookLog`.
- [x] 2.3 Implement storage abstraction in `internal/storage/storage.go`:
  - `MemoryStore`: Fast circular buffer (up to 500 emails).
  - `SQLiteStore`: Persistent database with auto-created tables and full-text indexing.

### Task 3: High-Throughput SMTP Daemon
- [x] 3.1 Implement `internal/smtp/server.go` using `github.com/emersion/go-smtp`:
  - Bind to `0.0.0.0:1025` (configurable).
  - Implement RFC 5321 command sequence (`HELO`, `EHLO`, `MAIL FROM`, `RCPT TO`, `DATA`, `RSET`, `QUIT`).
- [x] 3.2 Implement `internal/smtp/auth.go`:
  - Accept any `AUTH PLAIN` / `AUTH LOGIN` credentials without rejection for zero-config integration.
- [x] 3.3 Implement `internal/smtp/session.go`:
  - Capture raw envelope sender, recipients, client IP, and byte stream.

### Task 4: MIME Parser, Sanitizer & CID Inline Resolver
- [x] 4.1 Implement `internal/mime/parser.go`:
  - Decode multipart/alternative, multipart/related, and multipart/mixed.
  - Decode Quoted-Printable and Base64 content transfers.
  - Handle character set encodings (UTF-8, ISO-8859-1, Windows-1252).
- [x] 4.2 Implement `internal/mime/cid_resolver.go`:
  - Scan HTML body for `<img src="cid:...">` tags.
  - Match with MIME attachment Content-ID and convert to `data:<type>;base64,<data>` inline URIs.
- [x] 4.3 Implement `internal/mime/attachments.go`:
  - Extract and store file attachments with mime types, filenames, and byte sizes.

### Task 5: OTP & Magic Link Extraction Engine
- [x] 5.1 Implement `internal/extractor/otp.go`:
  - Match numeric 4 to 8 digit verification codes and token formats (e.g., `G-123456`, `AB3-49F`).
  - Score candidate tokens based on surrounding keywords (code, verification, otp, pin, security).
- [x] 5.2 Implement `internal/extractor/magic_links.go`:
  - Parse all URLs in plain text and HTML bodies.
  - Identify authentication links containing query parameters like `token`, `code`, `verify`, `auth`, `login`.
  - Extract target host and parameters for quick inspection.

### Task 6: Deliverability & Spam Score Linter
- [x] 6.1 Implement `internal/linter/spam_rules.go`:
  - Deliverability score calculated from 0 to 100.
  - Rule: Text-to-image character and byte ratio check (< 60% text triggers penalty).
  - Rule: Subject line capitalization analysis (> 30% uppercase triggers penalty).
  - Rule: High-risk spam trigger phrase detector ("100% free", "urgent action", "act now", "claim prize").
  - Rule: Gmail 102 kB clipping threshold warning (> 102 kB triggers warning).
- [x] 6.2 Implement `internal/linter/headers_check.go`:
  - Verify presence of `Message-ID`, `Date`, `From`, `To`, `Subject`, `List-Unsubscribe`.
- [x] 6.3 Implement `internal/linter/link_checker.go`:
  - Flag unencrypted `http://` links, IP-based destinations, and malformed targets.

### Task 7: Webhook Dispatcher & Sample Generator
- [x] 7.1 Implement `internal/webhook/dispatcher.go`:
  - HTTP POST dispatcher forwarding incoming message JSON to specified webhook URL.
  - In-memory dispatch audit log (timestamp, URL, status code, response time).
- [x] 7.2 Implement `internal/sample/generator.go`:
  - Generate realistic test messages:
    1. Welcome email with OTP code.
    2. Password reset email with magic link.
    3. E-commerce order confirmation with inline CID logo and attachment.
    4. Promotional marketing email with spam trigger keywords.

### Task 8: REST API & Real-Time Event Broker
- [x] 8.1 Implement `internal/server/sse.go`:
  - Thread-safe Server-Sent Events broker streaming new message events, deletions, and stats.
- [x] 8.2 Implement `internal/server/api.go`:
  - `GET /api/messages`: List messages with filtering and pagination.
  - `GET /api/messages/{id}`: Detailed message view.
  - `GET /api/messages/{id}/html`: Pure HTML payload for sandbox iframe.
  - `GET /api/messages/{id}/raw`: Raw RFC 5322 EML download.
  - `GET /api/messages/{id}/attachments/{filename}`: Binary attachment download.
  - `DELETE /api/messages/{id}`: Delete message.
  - `DELETE /api/messages`: Clear all messages.
  - `POST /api/messages/{id}/forward`: Forward message to webhook.
  - `POST /api/send-sample`: Generate sample email on demand.
  - `GET /api/stats`: Inbox statistics.
  - `GET /api/webhook/logs`: Webhook delivery logs.

### Task 9: Modern React 19 Frontend Web Studio
- [x] 9.1 Scaffold `web/` with Vite, React 19, TypeScript, Tailwind CSS, Lucide icons.
- [x] 9.2 Implement real-time SSE stream hook `useMailStream.ts`.
- [x] 9.3 Build component hierarchy:
  - `Header.tsx`: System status, port indicators, sample email trigger, clear all, theme toggle.
  - `MessageList.tsx`: Search, filter pills (all, OTP, flagged spam, attachments), message cards with unread badges.
  - `MessageDetail.tsx`: Tabs for Preview, Text, HTML Source, Raw MIME, Spam Audit, Attachments.
  - `DeviceFrame.tsx`: Responsive viewport selector (Desktop 100%, iPad 768px, iPhone 393px, Pixel 412px), orientation toggle, zoom scale.
  - `OtpBanner.tsx`: Prominent copyable OTP code pill with 1-click clipboard button and toast.
  - `SpamAuditScore.tsx`: Visual score gauge (0-100), severity badges, actionable fix list.
  - `RawMimeDrawer.tsx`: Monospace raw header and message inspector.
  - `WebhookModal.tsx`: Webhook endpoint configuration and delivery audit log.
- [x] 9.4 Embed frontend build into Go binary with `go:embed`.

### Task 10: CLI Entrypoint, Integration Testing & Verification
- [x] 10.1 Implement `cmd/mailpulse/main.go` with CLI flags (`--smtp-port`, `--web-port`, `--persist`, `--webhook`, `--no-open`).
- [x] 10.2 Write comprehensive Go integration tests:
  - Synthetic SMTP client sending multipart emails, CID images, OTP patterns, and spam words.
  - Assert MIME parsing accuracy, CID inlining, OTP extraction, and deliverability score calculations.
- [x] 10.3 Verify complete build with `go build -o mailpulse.exe ./cmd/mailpulse`.

### Task 11: Visual Assets, Portfolio & Broadcast
- [x] 11.1 Capture authentic software execution screenshots of the running MailPulse studio.
- [x] 11.2 Generate animated demo GIF `docs/images/mailpulse_demo.gif`.
- [x] 11.3 Embed screenshots and demo GIF into `README.md`.
- [x] 11.4 Synchronize MTLG Portfolio with LIVE status badge and media mappings.
- [x] 11.5 Broadcast announcement thread to @mtlglabs on X.

### Task 12: Production Automation & Quality Enhancements
- [x] 12.1 E2E Test Automation Long-Polling Waiter:
  - Implement `internal/server/waiter.go` (`GET /api/messages/wait?to={email}&timeout={sec}`).
  - Add `GET /api/messages/latest`.
  - Build `web/src/components/E2ESnippetsModal.tsx` with copyable recipes for Playwright, Cypress, Pytest, and cURL.
- [x] 12.2 Active Link Health Prober:
  - Implement `internal/linter/prober.go` (`POST /api/messages/{id}/probe-links`).
  - Add concurrent HTTP HEAD/GET health check with response latency reporting.
  - Render live status pills (status code, roundtrip duration) in `MessageDetail.tsx`.
- [x] 12.3 SMTP Chaos & Latency Simulator:
  - Implement `internal/smtp/chaos.go` (`GET /api/chaos/config`, `POST /api/chaos/config`).
  - Support configurable artificial network delay (0-5000ms) and failure rate (0-100%).
  - Simulate temporary and permanent SMTP error codes (421, 450, 550, 554).
  - Build `web/src/components/ChaosModal.tsx` with active indicator in `Header.tsx`.
- [x] 12.4 Dual View Mode with Synchronized Proportional Scrolling:
  - Upgrade `web/src/components/DeviceFrame.tsx` to support side-by-side Desktop and iPhone viewports.
  - Implement bi-directional proportional scroll synchronization between iframe viewports.
- [x] 12.5 Power-User Keyboard Shortcuts:
  - Implement Superhuman / Gmail navigation hotkeys (`j`/`k`, `c`, `s`, `x`, `Delete`, `1`-`5`, `?`).
  - Build `web/src/components/ShortcutsModal.tsx` cheat sheet dialog.
- [x] 12.6 Standalone Portable HTML & Full Archive ZIP Export:
  - Implement `internal/server/export.go` (`GET /api/messages/{id}/export-html` and `GET /api/export-zip`).
  - Add 1-click export triggers to `MessageDetail.tsx` and `Header.tsx`.
