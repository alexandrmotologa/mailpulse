package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/linter"
	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/alexandrmotologa/mailpulse/internal/sample"
	"github.com/alexandrmotologa/mailpulse/internal/smtp"
	"github.com/alexandrmotologa/mailpulse/internal/storage"
	"github.com/alexandrmotologa/mailpulse/internal/webhook"
)

// APIServer manages HTTP routes and services.
type APIServer struct {
	mux        *http.ServeMux
	store      storage.Storage
	dispatcher *webhook.Dispatcher
	broker     *SSEBroker
	waiters    *WaiterRegistry
	chaos      *smtp.ChaosManager
	webPort    int
	smtpPort   int
	server     *http.Server
}

// NewAPIServer creates and configures the API and web UI server.
func NewAPIServer(host string, webPort, smtpPort int, store storage.Storage, disp *webhook.Dispatcher, broker *SSEBroker, waiters *WaiterRegistry, chaos *smtp.ChaosManager) *APIServer {
	if waiters == nil {
		waiters = NewWaiterRegistry()
	}
	if chaos == nil {
		chaos = smtp.NewChaosManager()
	}

	mux := http.NewServeMux()
	s := &APIServer{
		mux:        mux,
		store:      store,
		dispatcher: disp,
		broker:     broker,
		waiters:    waiters,
		chaos:      chaos,
		webPort:    webPort,
		smtpPort:   smtpPort,
	}

	s.registerRoutes()

	addr := fmt.Sprintf("%s:%d", host, webPort)
	s.server = &http.Server{
		Addr:         addr,
		Handler:      s.corsMiddleware(mux),
		ReadTimeout:  35 * time.Second, // Accommodate long polling timeouts
		WriteTimeout: 35 * time.Second,
	}

	return s
}

func (s *APIServer) registerRoutes() {
	// API routes
	s.mux.HandleFunc("/api/events", s.broker.ServeHTTP)
	s.mux.HandleFunc("/api/messages/wait", s.handleWaitMessage)
	s.mux.HandleFunc("/api/messages/latest", s.handleLatestMessage)
	s.mux.HandleFunc("/api/messages", s.handleMessages)
	s.mux.HandleFunc("/api/messages/", s.handleMessageDetail)
	s.mux.HandleFunc("/api/send-sample", s.handleSendSample)
	s.mux.HandleFunc("/api/stats", s.handleStats)
	s.mux.HandleFunc("/api/webhook/logs", s.handleWebhookLogs)
	s.mux.HandleFunc("/api/webhook/config", s.handleWebhookConfig)
	s.mux.HandleFunc("/api/chaos/config", s.handleChaosConfig)
	s.mux.HandleFunc("/api/export-zip", s.handleExportZip)

	// Web UI SPA handler for all other routes
	spa := NewSPAHandler()
	s.mux.Handle("/", spa)
}

func (s *APIServer) Start() error {
	return s.server.ListenAndServe()
}

func (s *APIServer) Close() error {
	return s.server.Close()
}

func (s *APIServer) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// GET /api/messages/wait?to=&from=&subject=&query=&timeout=10s
func (s *APIServer) handleWaitMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	to := r.URL.Query().Get("to")
	from := r.URL.Query().Get("from")
	subject := r.URL.Query().Get("subject")
	query := r.URL.Query().Get("query")

	timeoutDuration := 5 * time.Second
	if tStr := r.URL.Query().Get("timeout"); tStr != "" {
		if d, err := time.ParseDuration(tStr); err == nil && d > 0 && d <= 30*time.Second {
			timeoutDuration = d
		} else if sec, err := strconv.Atoi(tStr); err == nil && sec > 0 && sec <= 30 {
			timeoutDuration = time.Duration(sec) * time.Second
		}
	}

	// 1. Check if matching message already arrived recently (within last 30s)
	ctx := r.Context()
	summaries, _, err := s.store.List(ctx, to, "", 10, 0)
	if err == nil {
		for _, sm := range summaries {
			msg, err := s.store.Get(ctx, sm.ID)
			if err == nil && time.Since(msg.ReceivedAt) < 30*time.Second {
				req := &WaitRequest{To: to, From: from, Subject: subject, Query: query}
				if req.matches(msg) {
					s.jsonResponse(w, http.StatusOK, msg)
					return
				}
			}
		}
	}

	// 2. Register waiter for incoming SMTP messages
	waitReq := &WaitRequest{
		To:      to,
		From:    from,
		Subject: subject,
		Query:   query,
		Ch:      make(chan *model.Message, 1),
	}

	s.waiters.Register(waitReq)
	defer s.waiters.Unregister(waitReq)

	select {
	case msg := <-waitReq.Ch:
		s.jsonResponse(w, http.StatusOK, msg)

	case <-r.Context().Done():
		return

	case <-time.After(timeoutDuration):
		s.jsonResponse(w, http.StatusRequestTimeout, map[string]interface{}{
			"timeout": true,
			"message": "Timed out waiting for matching email",
		})
	}
}

// GET /api/messages/latest?to=&from=&subject=
func (s *APIServer) handleLatestMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	query := r.URL.Query().Get("to")
	if query == "" {
		query = r.URL.Query().Get("query")
	}

	summaries, total, err := s.store.List(ctx, query, "", 1, 0)
	if err != nil || total == 0 {
		s.jsonError(w, "No messages found", http.StatusNotFound)
		return
	}

	msg, err := s.store.Get(ctx, summaries[0].ID)
	if err != nil {
		s.jsonError(w, "Message not found", http.StatusNotFound)
		return
	}

	s.jsonResponse(w, http.StatusOK, msg)
}

// GET /api/messages, DELETE /api/messages
func (s *APIServer) handleMessages(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	switch r.Method {
	case http.MethodGet:
		query := r.URL.Query().Get("query")
		tag := r.URL.Query().Get("tag")
		limit := 50
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}
		offset := 0
		if o := r.URL.Query().Get("offset"); o != "" {
			if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
				offset = parsed
			}
		}

		summaries, total, err := s.store.List(ctx, query, tag, limit, offset)
		if err != nil {
			s.jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}

		s.jsonResponse(w, http.StatusOK, map[string]interface{}{
			"total":    total,
			"limit":    limit,
			"offset":   offset,
			"messages": summaries,
		})

	case http.MethodDelete:
		if err := s.store.Clear(ctx); err != nil {
			s.jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		s.broker.Broadcast("clear_all", map[string]string{"status": "cleared"})
		w.WriteHeader(http.StatusNoContent)

	default:
		s.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// Routes under /api/messages/{id}
func (s *APIServer) handleMessageDetail(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/messages/")
	parts := strings.Split(path, "/")
	id := parts[0]

	if id == "" {
		s.jsonError(w, "Message ID required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Sub-actions: /api/messages/{id}/html, /raw, /read, /star, /forward, /probe-links, /export-html, /attachments/{filename}
	if len(parts) > 1 {
		action := parts[1]
		switch action {
		case "html":
			msg, err := s.store.Get(ctx, id)
			if err != nil {
				s.jsonError(w, "Message not found", http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(msg.HTMLBody))
			return

		case "export-html":
			msg, err := s.store.Get(ctx, id)
			if err != nil {
				s.jsonError(w, "Message not found", http.StatusNotFound)
				return
			}
			htmlDoc := GenerateStandaloneHTML(msg)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"mailpulse-%s.html\"", id[:8]))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(htmlDoc))
			return

		case "raw":
			msg, err := s.store.Get(ctx, id)
			if err != nil {
				s.jsonError(w, "Message not found", http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "message/rfc822")
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.eml\"", id))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(msg.RawEML)
			return

		case "attachments":
			if len(parts) < 3 {
				s.jsonError(w, "Attachment filename required", http.StatusBadRequest)
				return
			}
			attName := parts[2]
			msg, err := s.store.Get(ctx, id)
			if err != nil {
				s.jsonError(w, "Message not found", http.StatusNotFound)
				return
			}
			for _, att := range msg.Attachments {
				if att.Filename == attName || att.ID == attName {
					w.Header().Set("Content-Type", att.ContentType)
					w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", att.Filename))
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write(att.Data)
					return
				}
			}
			s.jsonError(w, "Attachment not found", http.StatusNotFound)
			return

		case "probe-links":
			if r.Method != http.MethodPost {
				s.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			msg, err := s.store.Get(ctx, id)
			if err != nil {
				s.jsonError(w, "Message not found", http.StatusNotFound)
				return
			}
			results := linter.ProbeLinks(ctx, msg.MagicLinks)
			s.jsonResponse(w, http.StatusOK, map[string]interface{}{
				"results": results,
			})
			return

		case "read":
			if r.Method != http.MethodPost {
				s.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			var req struct {
				IsRead bool `json:"isRead"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			if err := s.store.MarkRead(ctx, id, req.IsRead); err != nil {
				s.jsonError(w, err.Error(), http.StatusNotFound)
				return
			}
			s.broker.Broadcast("update_message", map[string]interface{}{"id": id, "isRead": req.IsRead})
			s.jsonResponse(w, http.StatusOK, map[string]bool{"isRead": req.IsRead})
			return

		case "star":
			if r.Method != http.MethodPost {
				s.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			var req struct {
				IsStarred bool `json:"isStarred"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			if err := s.store.MarkStarred(ctx, id, req.IsStarred); err != nil {
				s.jsonError(w, err.Error(), http.StatusNotFound)
				return
			}
			s.broker.Broadcast("update_message", map[string]interface{}{"id": id, "isStarred": req.IsStarred})
			s.jsonResponse(w, http.StatusOK, map[string]bool{"isStarred": req.IsStarred})
			return

		case "forward":
			if r.Method != http.MethodPost {
				s.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			var req struct {
				TargetURL string `json:"targetUrl"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			msg, err := s.store.Get(ctx, id)
			if err != nil {
				s.jsonError(w, "Message not found", http.StatusNotFound)
				return
			}
			log, err := s.dispatcher.Forward(ctx, req.TargetURL, msg)
			if err != nil {
				s.jsonResponse(w, http.StatusOK, map[string]interface{}{
					"success": false,
					"error":   err.Error(),
					"log":     log,
				})
				return
			}
			s.jsonResponse(w, http.StatusOK, map[string]interface{}{
				"success": true,
				"log":     log,
			})
			return
		}
	}

	// Main /api/messages/{id} handler
	switch r.Method {
	case http.MethodGet:
		msg, err := s.store.Get(ctx, id)
		if err != nil {
			s.jsonError(w, "Message not found", http.StatusNotFound)
			return
		}
		_ = s.store.MarkRead(ctx, id, true)
		s.jsonResponse(w, http.StatusOK, msg)

	case http.MethodDelete:
		if err := s.store.Delete(ctx, id); err != nil {
			s.jsonError(w, "Message not found", http.StatusNotFound)
			return
		}
		s.broker.Broadcast("delete_message", map[string]string{"id": id})
		w.WriteHeader(http.StatusNoContent)

	default:
		s.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// POST /api/send-sample
func (s *APIServer) handleSendSample(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Template string `json:"template"` // "otp", "reset", "receipt", "spam", "alert"
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	msg := sample.Generate(req.Template)
	ctx := r.Context()
	if err := s.store.Save(ctx, msg); err != nil {
		s.jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	s.broker.Broadcast("new_message", msg.ToSummary())
	s.waiters.Notify(msg)

	if s.dispatcher.GetDefaultURL() != "" {
		go func(m *model.Message) {
			_, _ = s.dispatcher.Forward(context.Background(), "", m)
		}(msg)
	}

	s.jsonResponse(w, http.StatusCreated, msg)
}

// GET /api/stats
func (s *APIServer) handleStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.store.GetStats(r.Context())
	if err != nil {
		s.jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	s.jsonResponse(w, http.StatusOK, stats)
}

// GET /api/webhook/logs
func (s *APIServer) handleWebhookLogs(w http.ResponseWriter, r *http.Request) {
	logs := s.dispatcher.GetLogs()
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"logs": logs,
	})
}

// GET /api/webhook/config, POST /api/webhook/config
func (s *APIServer) handleWebhookConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var req struct {
			URL string `json:"url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			s.jsonError(w, "Invalid JSON payload", http.StatusBadRequest)
			return
		}
		s.dispatcher.SetDefaultURL(req.URL)
		s.jsonResponse(w, http.StatusOK, map[string]string{"url": s.dispatcher.GetDefaultURL()})
		return
	}

	s.jsonResponse(w, http.StatusOK, map[string]string{"url": s.dispatcher.GetDefaultURL()})
}

// GET /api/chaos/config, POST /api/chaos/config
func (s *APIServer) handleChaosConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var cfg smtp.ChaosConfig
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			s.jsonError(w, "Invalid chaos config JSON", http.StatusBadRequest)
			return
		}
		s.chaos.SetConfig(cfg)
		s.jsonResponse(w, http.StatusOK, s.chaos.GetConfig())
		return
	}

	s.jsonResponse(w, http.StatusOK, s.chaos.GetConfig())
}

// GET /api/export-zip
func (s *APIServer) handleExportZip(w http.ResponseWriter, r *http.Request) {
	if err := StreamZIPExport(w, s.store); err != nil {
		s.jsonError(w, "Failed to generate ZIP archive: "+err.Error(), http.StatusInternalServerError)
	}
}

func (s *APIServer) jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (s *APIServer) jsonError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
