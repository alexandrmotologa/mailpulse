# MailPulse Architecture

This document describes the internal design, concurrency model, and data flow of MailPulse.

## System Overview

MailPulse is structured as two primary components: a Go backend handling SMTP reception and data processing, and a React 19 web frontend for inspection.

```
                      +-----------------------------+
                      |   Outgoing Email Client     |
                      | (Node, Python, Go, Laravel) |
                      +--------------+--------------+
                                     |
                                     | SMTP (:1025)
                                     v
                      +-----------------------------+
                      |     SMTP Server Daemon      |
                      |  (emersion/go-smtp engine)  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |       MIME Parser           |
                      |  * Decode Multipart Parts   |
                      |  * Inline CID Image Data    |
                      |  * Extract Attachments      |
                      +--------------+--------------+
                                     |
                +--------------------+--------------------+
                |                                         |
                v                                         v
+-------------------------------+         +-------------------------------+
|  OTP & Magic Link Extractor   |         | Deliverability & Spam Linter  |
|  * Regex Pin Matchers         |         |  * Text to Image Ratio        |
|  * Auth Token Parameter Parse |         |  * Header Compliance          |
+---------------+---------------+         +---------------+---------------+
                |                                         |
                +--------------------+--------------------+
                                     |
                                     v
                      +-----------------------------+
                      |      Storage Engine         |
                      | (Ring Buffer / SQLite DB)   |
                      +--------------+--------------+
                                     |
                +--------------------+--------------------+
                |                                         |
                v                                         v
+-------------------------------+         +-------------------------------+
|    Server-Sent Events (SSE)   |         |   Local Webhook Dispatcher    |
|    Real-Time Browser Feed     |         |   Outgoing HTTP POST Task     |
+---------------+---------------+         +-------------------------------+
                |
                v
+-------------------------------+
|     React 19 Web Studio       |
|  * Sandboxed Device Frame     |
|  * Dark / Light Simulation    |
|  * 1-Click Code Copying       |
+-------------------------------+
```

## Core Subsystems

### 1. SMTP Ingestion Engine (`internal/smtp`)

The SMTP listener is built on top of `github.com/emersion/go-smtp`.
- **Zero Friction Authentication**: Implements an auth handler accepting any username and password pair, or unauthenticated sessions. This allows developers to use dummy credentials without configuration errors.
- **Session Management**: Each connection receives an isolated session tracking envelope senders (`MAIL FROM`), envelope recipients (`RCPT TO`), client IP addresses, and the raw RFC 5322 data stream.
- **Buffer Limits**: Message payloads are streamed into memory with a configurable maximum size (default 25 MB) to avoid unbounded memory consumption while accommodating large development attachments.

### 2. MIME and Content Resolver (`internal/mime`)

Incoming email streams are parsed into structured models:
- **Multipart Traversal**: Recursively unpacks `multipart/alternative`, `multipart/related`, and `multipart/mixed` structures.
- **Content-ID Resolution**: Many HTML emails reference attached images via `cid:image-name.png`. The CID resolver matches these against attachment parts and replaces the attributes with base64 data URIs (`data:image/png;base64,...`), enabling images to render in an isolated browser iframe without external requests.
- **HTML Isolation**: HTML bodies are rendered in an iframe configured with `sandbox="allow-popups allow-popups-to-escape-sandbox"`. Scripts are prevented from executing in the parent context.

### 3. Verification Code and Magic Link Extractor (`internal/extractor`)

Developers frequently check development inboxes solely to copy verification codes:
- **OTP Patterns**: Regular expressions match 4 to 8 digit numbers surrounded by verification keywords (code, verification, otp, pin, token, confirm).
- **Magic Links**: Scans HTML anchor tags and plaintext URLs for query parameters containing authentication tokens (`token=`, `code=`, `verify`, `auth`, `login`).
- **One Click Access**: Extracted tokens are exposed in the API and presented as copyable pills at the top of the interface.

### 4. Deliverability and Spam Linter (`internal/linter`)

The linter evaluates common anti-spam criteria before emails are sent to production:
- **Text-to-Image Ratio**: Measures the volume of readable text compared to image assets. Emails containing high image volumes with minimal text trigger spam filter penalties.
- **Header Audits**: Validates required RFC 5322 headers including `Message-ID`, `Date`, `From`, `To`, and `Subject`. Flags absence of `List-Unsubscribe` for bulk messages.
- **Gmail 102 kB Clipping Warning**: Gmail truncates HTML bodies exceeding 102,400 bytes, hiding content behind a "View entire message" link. MailPulse alerts when message sizes exceed this boundary.
- **Insecure Links**: Scans anchor tags for insecure plain `http://` links.

### 5. Storage Layer (`internal/storage`)

- **In-Memory Ring Buffer**: The default storage driver retains up to 500 messages in a thread-safe circular list. Oldest messages are purged when the capacity limit is reached.
- **SQLite Engine**: Activated via `--persist`. Writes messages, attachments metadata, and linter reports to a local SQLite database file, enabling persistence across restarts.

### 6. Event Streaming and Webhooks (`internal/server`, `internal/webhook`)

- **Server-Sent Events (SSE)**: The `/api/events` endpoint broadcasts incoming email events, deletions, and statistics to connected browser clients with negligible overhead.
- **Webhook Dispatcher**: Runs asynchronous HTTP POST workers to forward captured payloads to local development services.
