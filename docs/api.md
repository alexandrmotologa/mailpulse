# MailPulse REST API Specification

The MailPulse HTTP API runs on port 8025 by default and serves JSON responses.

## Endpoints

### 1. List Messages

```http
GET /api/messages?query=&tag=&limit=50&offset=0
```

#### Query Parameters
- `query` (optional): Filter messages by subject, sender, or recipient.
- `tag` (optional): Filter by category (`otp`, `flagged`, `has_attachment`).
- `limit` (optional): Maximum items to return (default 50, maximum 200).
- `offset` (optional): Pagination offset (default 0).

#### Response (`200 OK`)
```json
{
  "total": 1,
  "messages": [
    {
      "id": "msg_01jh19...",
      "receivedAt": "2026-10-22T14:32:10Z",
      "from": {
        "name": "Acme Auth",
        "address": "noreply@example.com"
      },
      "to": [
        {
          "name": "Dev User",
          "address": "dev@example.com"
        }
      ],
      "subject": "Your verification code is 842109",
      "snippet": "Your verification code is 842109. Valid for 10 minutes.",
      "hasHtml": true,
      "hasText": true,
      "attachmentCount": 0,
      "otpCode": "842109",
      "spamScore": 96,
      "sizeBytes": 1420
    }
  ]
}
```

---

### 2. Get Message Detail

```http
GET /api/messages/{id}
```

#### Response (`200 OK`)
```json
{
  "id": "msg_01jh19...",
  "receivedAt": "2026-10-22T14:32:10Z",
  "from": {
    "name": "Acme Auth",
    "address": "noreply@example.com"
  },
  "to": [
    {
      "name": "Dev User",
      "address": "dev@example.com"
    }
  ],
  "cc": [],
  "bcc": [],
  "replyTo": [],
  "subject": "Your verification code is 842109",
  "snippet": "Your verification code is 842109. Valid for 10 minutes.",
  "textBody": "Your verification code is 842109. Valid for 10 minutes.",
  "htmlBody": "<p>Your verification code is <strong>842109</strong>.</p>",
  "headers": {
    "Message-ID": ["<msg-123@example.com>"],
    "Date": ["Thu, 22 Oct 2026 14:32:10 +0000"],
    "Content-Type": ["text/html; charset=UTF-8"]
  },
  "attachments": [],
  "otp": {
    "code": "842109",
    "type": "numeric_6",
    "context": "verification code"
  },
  "magicLinks": [
    {
      "url": "https://example.com/verify?code=842109",
      "text": "Verify Account",
      "host": "example.com",
      "category": "verification"
    }
  ],
  "spamReport": {
    "score": 96,
    "verdict": "pass",
    "textToImageRatio": 95.2,
    "htmlSizeBytes": 1280,
    "issues": []
  }
}
```

---

### 3. Long-Polling Wait for E2E Test Automation

```http
GET /api/messages/wait?to=user@example.com&subject=Verify&timeout=15
```

Blocks execution until an email matching the filter criteria arrives, or returns HTTP 408 when the timeout expires. Designed for Playwright, Cypress, Pytest, and CI automation.

#### Query Parameters
- `to` (optional): Recipient address filter.
- `subject` (optional): Case-insensitive substring match on message subject.
- `timeout` (optional): Maximum duration in seconds to wait (default 10, max 30).

#### Response (`200 OK`)
Returns the complete `Message` domain model immediately upon arrival.

#### Response (`408 Request Timeout`)
```json
{
  "error": "Timeout waiting for message matching criteria",
  "timeout": 15
}
```

---

### 4. Get Latest Message

```http
GET /api/messages/latest?to=user@example.com
```

Returns the most recently captured email matching the optional recipient filter, or 404 if none found.

---

### 5. Probe All Extracted Links

```http
POST /api/messages/{id}/probe-links
```

Performs concurrent HTTP HEAD/GET health checks on all extracted magic links in the specified message.

#### Response (`200 OK`)
```json
{
  "results": [
    {
      "url": "https://myapp.local/verify?token=abc",
      "statusCode": 200,
      "ok": true,
      "durationMs": 14,
      "redirectUrl": ""
    }
  ]
}
```

---

### 6. Export Self-Contained Standalone HTML

```http
GET /api/messages/{id}/export-html
```

Generates a portable, single-file HTML document containing the email body, metadata header, deliverability badge, and extracted OTP passcode. Ideal for team sharing and bug reports.

#### Response Headers
- `Content-Type: text/html; charset=utf-8`
- `Content-Disposition: attachment; filename="mailpulse-{id}.html"`

---

### 7. Export All Messages as ZIP Archive

```http
GET /api/export-zip
```

Streams a complete archive containing:
- `manifest.json`: Index of all captured emails and metadata.
- `messages/*.eml`: Raw RFC 5322 source files.
- `attachments/*/*`: All binary attachments organized by message ID.

---

### 8. SMTP Chaos & Latency Simulator Configuration

```http
GET /api/chaos/config
POST /api/chaos/config
Content-Type: application/json

{
  "enabled": true,
  "latencyMs": 500,
  "failureRate": 25,
  "errorCode": 421,
  "errorMessage": "4.3.0 MailPulse Chaos: Temporary service failure"
}
```

Injects artificial network delays and configurable SMTP error codes to test application retry policies.

---

### 9. Get Rendered HTML Body

```http
GET /api/messages/{id}/html
```

Returns the sanitized HTML body with resolved inline `cid:` images for iframe consumption.

---

### 10. Download Raw EML

```http
GET /api/messages/{id}/raw
```

Downloads the unparsed RFC 5322 byte stream as an `.eml` file.

---

### 11. Download Attachment

```http
GET /api/messages/{id}/attachments/{filename}
```

Downloads a specific file attachment by filename or attachment identifier.

---

### 12. Delete Message

```http
DELETE /api/messages/{id}
```

Deletes a single message from the store. Returns `204 No Content`.

---

### 13. Clear All Messages

```http
DELETE /api/messages
```

Purges all messages from the store. Returns `204 No Content`.

---

### 14. Forward Message to Webhook

```http
POST /api/messages/{id}/forward
Content-Type: application/json

{
  "targetUrl": "http://127.0.0.1:3000/api/webhook"
}
```

Manually forwards the specified message to an HTTP endpoint.

---

### 15. Generate Sample Message

```http
POST /api/send-sample
Content-Type: application/json

{
  "template": "otp" | "reset" | "receipt" | "spam" | "alert"
}
```

Generates a realistic test message and ingests it into the inbox.

---

### 16. Inbox Statistics

```http
GET /api/stats
```

---

### 17. Real-Time Events Stream (SSE)

```http
GET /api/events
Accept: text/event-stream
```

Streams server-sent events for:
- `new_message`: Emitted when an email arrives.
- `update_message`: Emitted when read or starred state changes.
- `delete_message`: Emitted when a message is removed.
- `clear_all`: Emitted when the inbox is emptied.
