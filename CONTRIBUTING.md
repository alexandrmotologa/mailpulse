# Contributing to MailPulse

Thank you for your interest in contributing to MailPulse.

## Development Setup

### Requirements

- Go 1.23+
- Node.js 20+
- npm 10+

### Repository Structure

- `cmd/mailpulse`: Main entry point and CLI commands.
- `internal/smtp`: SMTP listener and session handler.
- `internal/mime`: MIME decoder, multipart parser, and CID inline resolver.
- `internal/extractor`: OTP and magic link pattern detectors.
- `internal/linter`: Spam and deliverability heuristics.
- `internal/storage`: In-memory ring buffer and SQLite persistence.
- `internal/server`: HTTP API and Server-Sent Events broker.
- `web`: React 19 frontend built with Tailwind CSS.

### Running Locally

1. Install frontend dependencies and run Vite dev server:
   ```bash
   cd web
   npm install
   npm run dev
   ```

2. Run the Go backend in another terminal:
   ```bash
   go run cmd/mailpulse/main.go --no-open
   ```

3. Run Go tests:
   ```bash
   go test ./...
   ```

### Code Style Guidelines

- Format Go code using `gofmt` and follow standard Go conventions.
- Format TypeScript and CSS using standard linter settings in `web/`.
- Keep documentation factual and avoid empty promotional phrasing or artificial superlatives.
