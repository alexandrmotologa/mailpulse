# Stage 1: Build React 19 Frontend Web Studio
FROM node:20-alpine AS web-builder
WORKDIR /app/web

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# Stage 2: Build Static Go Binary with Embedded Assets
FROM golang:1.23-alpine AS go-builder
WORKDIR /app

RUN apk add --no-cache ca-certificates git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Copy compiled frontend into Go embed target directory
COPY --from=web-builder /app/web/dist ./internal/server/web_dist

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-s -w" -o /mailpulse cmd/mailpulse/main.go

# Stage 3: Minimal Production Image
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=go-builder /mailpulse /app/mailpulse

EXPOSE 1025 8025

ENTRYPOINT ["/app/mailpulse"]
CMD ["--host", "0.0.0.0", "--no-open"]
