package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alexandrmotologa/mailpulse/internal/storage"
	"github.com/alexandrmotologa/mailpulse/internal/webhook"
)

func setupTestServer() (*APIServer, storage.Storage, *webhook.Dispatcher, *SSEBroker) {
	store := storage.NewMemoryStore(50, 1025, 8025)
	disp := webhook.NewDispatcher("")
	broker := NewSSEBroker()
	server := NewAPIServer("127.0.0.1", 8025, 1025, store, disp, broker)
	return server, store, disp, broker
}

func TestAPISendSampleAndList(t *testing.T) {
	server, _, _, broker := setupTestServer()
	defer broker.Close()

	// 1. Send sample email via POST /api/send-sample
	body, _ := json.Marshal(map[string]string{"template": "otp"})
	req := httptest.NewRequest(http.MethodPost, "/api/send-sample", bytes.NewReader(body))
	w := httptest.NewRecorder()
	server.mux.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}

	var createdMsg map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &createdMsg)
	msgID, ok := createdMsg["id"].(string)
	if !ok || msgID == "" {
		t.Fatalf("expected message id in response, got %+v", createdMsg)
	}

	// 2. List messages via GET /api/messages
	reqList := httptest.NewRequest(http.MethodGet, "/api/messages", nil)
	wList := httptest.NewRecorder()
	server.mux.ServeHTTP(wList, reqList)

	if wList.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", wList.Code)
	}

	var listResp struct {
		Total    int                      `json:"total"`
		Messages []map[string]interface{} `json:"messages"`
	}
	_ = json.Unmarshal(wList.Body.Bytes(), &listResp)

	if listResp.Total != 1 || len(listResp.Messages) != 1 {
		t.Fatalf("expected 1 message, got total=%d, len=%d", listResp.Total, len(listResp.Messages))
	}

	// 3. Get message HTML via GET /api/messages/{id}/html
	reqHTML := httptest.NewRequest(http.MethodGet, "/api/messages/"+msgID+"/html", nil)
	wHTML := httptest.NewRecorder()
	server.mux.ServeHTTP(wHTML, reqHTML)

	if wHTML.Code != http.StatusOK {
		t.Fatalf("expected 200 for HTML, got %d", wHTML.Code)
	}
	if wHTML.Header().Get("Content-Type") != "text/html; charset=utf-8" {
		t.Errorf("expected text/html charset=utf-8, got %s", wHTML.Header().Get("Content-Type"))
	}

	// 4. Get stats via GET /api/stats
	reqStats := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	wStats := httptest.NewRecorder()
	server.mux.ServeHTTP(wStats, reqStats)

	if wStats.Code != http.StatusOK {
		t.Fatalf("expected 200 for stats, got %d", wStats.Code)
	}

	// 5. Delete message via DELETE /api/messages/{id}
	reqDel := httptest.NewRequest(http.MethodDelete, "/api/messages/"+msgID, nil)
	wDel := httptest.NewRecorder()
	server.mux.ServeHTTP(wDel, reqDel)

	if wDel.Code != http.StatusNoContent {
		t.Fatalf("expected 204 No Content for delete, got %d", wDel.Code)
	}
}

func TestWebhookConfigEndpoint(t *testing.T) {
	server, _, _, broker := setupTestServer()
	defer broker.Close()

	// Update webhook URL
	configBody, _ := json.Marshal(map[string]string{"url": "http://127.0.0.1:4000/hooks/mail"})
	req := httptest.NewRequest(http.MethodPost, "/api/webhook/config", bytes.NewReader(configBody))
	w := httptest.NewRecorder()
	server.mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// Fetch webhook URL
	reqGet := httptest.NewRequest(http.MethodGet, "/api/webhook/config", nil)
	wGet := httptest.NewRecorder()
	server.mux.ServeHTTP(wGet, reqGet)

	var resp map[string]string
	_ = json.Unmarshal(wGet.Body.Bytes(), &resp)
	if resp["url"] != "http://127.0.0.1:4000/hooks/mail" {
		t.Errorf("expected updated URL, got %s", resp["url"])
	}
}
