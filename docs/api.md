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
  "text": "Your verification code is 842109. Valid for 10 minutes.",
  "html": "<p>Your verification code is <strong>842109</strong>.</p>",
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
      "token": "842109"
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

### 3. Get Rendered HTML Body

```http
GET /api/messages/{id}/html
```

Returns the sanitized HTML body with resolved inline `cid:` images for iframe consumption.

#### Response Headers
- `Content-Type: text/html; charset=utf-8`

---

### 4. Download Raw EML

```http
GET /api/messages/{id}/raw
```

Downloads the unparsed RFC 5322 byte stream as an `.eml` file.

#### Response Headers
- `Content-Type: message/rfc822`
- `Content-Disposition: attachment; filename="{id}.eml"`

---

### 5. Download Attachment

```http
GET /api/messages/{id}/attachments/{filename}
```

Downloads a specific file attachment by filename or attachment identifier.

---

### 6. Delete Message

```http
DELETE /api/messages/{id}
```

Deletes a single message from the store. Returns `204 No Content`.

---

### 7. Clear All Messages

```http
DELETE /api/messages
```

Purges all messages from the store. Returns `204 No Content`.

---

### 8. Forward Message to Webhook

```http
POST /api/messages/{id}/forward
Content-Type: application/json

{
  "targetUrl": "http://127.0.0.1:3000/api/webhook"
}
```

Manually forwards the specified message to an HTTP endpoint.

---

### 9. Generate Sample Message

```http
POST /api/send-sample
Content-Type: application/json

{
  "template": "otp" | "reset" | "receipt" | "spam" | "alert"
}
```

Generates a realistic test message and ingests it into the inbox.

---

### 10. Inbox Statistics

```http
GET /api/stats
```

#### Response (`200 OK`)
```json
{
  "totalMessages": 14,
  "unreadCount": 3,
  "otpCount": 5,
  "flaggedSpamCount": 1,
  "smtpPort": 1025,
  "webPort": 8025,
  "storageType": "memory",
  "uptimeSeconds": 1420
}
```

---

### 11. Real-Time Events Stream (SSE)

```http
GET /api/events
Accept: text/event-stream
```

Streams server-sent events for:
- `new_message`: Emitted when an email arrives.
- `delete_message`: Emitted when a message is removed.
- `clear_all`: Emitted when the inbox is emptied.
