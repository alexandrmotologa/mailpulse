package server

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/alexandrmotologa/mailpulse/internal/smtp"
	"github.com/alexandrmotologa/mailpulse/internal/storage"
	"github.com/alexandrmotologa/mailpulse/internal/webhook"
)

func setupTestServer() (*APIServer, storage.Storage, *webhook.Dispatcher, *SSEBroker, *WaiterRegistry, *smtp.ChaosManager) {
	store := storage.NewMemoryStore(50, 1025, 8025)
	disp := webhook.NewDispatcher("")
	broker := NewSSEBroker()
	waiters := NewWaiterRegistry()
	chaos := smtp.NewChaosManager()
	server := NewAPIServer("127.0.0.1", 8025, 1025, store, disp, broker, waiters, chaos)
	return server, store, disp, broker, waiters, chaos
}

func TestAPISendSampleAndList(t *testing.T) {
	server, _, _, broker, _, _ := setupTestServer()
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
	server, _, _, broker, _, _ := setupTestServer()
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

func TestWaitMessageEndpoint(t *testing.T) {
	server, store, _, broker, waiters, _ := setupTestServer()
	defer broker.Close()

	// Case 1: Message arriving asynchronously while waiter is waiting
	done := make(chan struct{})
	go func() {
		req := httptest.NewRequest(http.MethodGet, "/api/messages/wait?to=user@example.com&timeout=3", nil)
		w := httptest.NewRecorder()
		server.mux.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200 from wait, got %d", w.Code)
		}
		var msg model.Message
		if err := json.Unmarshal(w.Body.Bytes(), &msg); err != nil {
			t.Errorf("failed to unmarshal message: %v", err)
		}
		if msg.Subject != "Asynchronous Welcome" {
			t.Errorf("expected subject 'Asynchronous Welcome', got %s", msg.Subject)
		}
		close(done)
	}()

	// Wait 100ms then deliver message
	time.Sleep(100 * time.Millisecond)
	testMsg := &model.Message{
		ID:         "async-msg-1",
		Subject:    "Asynchronous Welcome",
		ReceivedAt: time.Now(),
		To:         []model.Address{{Address: "user@example.com"}},
		From:       model.Address{Address: "team@mailpulse.local"},
		HTMLBody:   "<p>Your code is 987654</p>",
	}
	_ = store.Save(context.Background(), testMsg)
	waiters.Notify(testMsg)

	select {
	case <-done:
	case <-time.After(4 * time.Second):
		t.Fatal("timed out waiting for asynchronous waiter")
	}

	// Case 2: Timeout when no matching message arrives
	reqTimeout := httptest.NewRequest(http.MethodGet, "/api/messages/wait?to=nonexistent@domain.com&timeout=1", nil)
	wTimeout := httptest.NewRecorder()
	server.mux.ServeHTTP(wTimeout, reqTimeout)

	if wTimeout.Code != http.StatusRequestTimeout {
		t.Fatalf("expected 408 Request Timeout, got %d", wTimeout.Code)
	}
}

func TestLatestMessageEndpoint(t *testing.T) {
	server, store, _, broker, _, _ := setupTestServer()
	defer broker.Close()

	// Initial check: empty store returns 404
	req404 := httptest.NewRequest(http.MethodGet, "/api/messages/latest", nil)
	w404 := httptest.NewRecorder()
	server.mux.ServeHTTP(w404, req404)
	if w404.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for empty inbox, got %d", w404.Code)
	}

	// Insert message and check
	msg := &model.Message{
		ID:         "msg-latest-test",
		Subject:    "Latest Subject Test",
		ReceivedAt: time.Now(),
		To:         []model.Address{{Address: "tester@qa.org"}},
		From:       model.Address{Address: "noreply@app.com"},
		HTMLBody:   "<p>Test latest</p>",
	}
	_ = store.Save(context.Background(), msg)

	reqLatest := httptest.NewRequest(http.MethodGet, "/api/messages/latest?to=tester@qa.org", nil)
	wLatest := httptest.NewRecorder()
	server.mux.ServeHTTP(wLatest, reqLatest)

	if wLatest.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", wLatest.Code)
	}
	var respMsg model.Message
	_ = json.Unmarshal(wLatest.Body.Bytes(), &respMsg)
	if respMsg.ID != "msg-latest-test" {
		t.Errorf("expected ID msg-latest-test, got %s", respMsg.ID)
	}
}

func TestProbeLinksEndpoint(t *testing.T) {
	server, store, _, broker, _, _ := setupTestServer()
	defer broker.Close()

	// Mock target server to probe
	mockTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	}))
	defer mockTarget.Close()

	msg := &model.Message{
		ID:         "msg-probe-test",
		Subject:    "Probe Test",
		ReceivedAt: time.Now(),
		To:         []model.Address{{Address: "prober@qa.org"}},
		From:       model.Address{Address: "noreply@app.com"},
		HTMLBody:   fmt.Sprintf(`<p><a href="%s">Click Here</a></p>`, mockTarget.URL),
		MagicLinks: []model.MagicLink{
			{URL: mockTarget.URL, Text: "Click Here"},
		},
	}
	_ = store.Save(context.Background(), msg)

	reqProbe := httptest.NewRequest(http.MethodPost, "/api/messages/"+msg.ID+"/probe-links", nil)
	wProbe := httptest.NewRecorder()
	server.mux.ServeHTTP(wProbe, reqProbe)

	if wProbe.Code != http.StatusOK {
		t.Fatalf("expected 200 from probe-links, got %d", wProbe.Code)
	}

	var probeResp struct {
		Results []map[string]interface{} `json:"results"`
	}
	if err := json.Unmarshal(wProbe.Body.Bytes(), &probeResp); err != nil {
		t.Fatalf("failed to decode probe results: %v", err)
	}
	if len(probeResp.Results) != 1 {
		t.Fatalf("expected 1 probe result, got %d", len(probeResp.Results))
	}
	if statusCode, ok := probeResp.Results[0]["statusCode"].(float64); !ok || int(statusCode) != 200 {
		t.Errorf("expected statusCode 200, got %v", probeResp.Results[0]["statusCode"])
	}
}

func TestExportHTMLEndpoint(t *testing.T) {
	server, store, _, broker, _, _ := setupTestServer()
	defer broker.Close()

	msg := &model.Message{
		ID:         "msg-export-html",
		Subject:    "Invoice 1042",
		ReceivedAt: time.Now(),
		To:         []model.Address{{Address: "billing@client.com"}},
		From:       model.Address{Address: "invoicing@stripe.com"},
		HTMLBody:   "<div><p>Your payment receipt</p></div>",
	}
	_ = store.Save(context.Background(), msg)

	reqExport := httptest.NewRequest(http.MethodGet, "/api/messages/"+msg.ID+"/export-html", nil)
	wExport := httptest.NewRecorder()
	server.mux.ServeHTTP(wExport, reqExport)

	if wExport.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", wExport.Code)
	}
	disposition := wExport.Header().Get("Content-Disposition")
	if disposition == "" || !bytes.Contains([]byte(disposition), []byte(".html")) {
		t.Errorf("expected attachment Content-Disposition with .html, got %s", disposition)
	}
	if !bytes.Contains(wExport.Body.Bytes(), []byte("MailPulse Snapshot")) {
		t.Errorf("expected standalone header in HTML output")
	}
}

func TestExportZIPEndpoint(t *testing.T) {
	server, store, _, broker, _, _ := setupTestServer()
	defer broker.Close()

	msg := &model.Message{
		ID:         "msg-zip-1",
		Subject:    "Verification Needed",
		ReceivedAt: time.Now(),
		To:         []model.Address{{Address: "alex@example.com"}},
		From:       model.Address{Address: "auth@service.com"},
		HTMLBody:   "<p>Your code is 123456</p>",
		RawEML:     []byte("Subject: Verification Needed\r\n\r\nYour code is 123456"),
	}
	_ = store.Save(context.Background(), msg)

	reqZIP := httptest.NewRequest(http.MethodGet, "/api/export-zip", nil)
	wZIP := httptest.NewRecorder()
	server.mux.ServeHTTP(wZIP, reqZIP)

	if wZIP.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", wZIP.Code)
	}

	zipReader, err := zip.NewReader(bytes.NewReader(wZIP.Body.Bytes()), int64(wZIP.Body.Len()))
	if err != nil {
		t.Fatalf("failed to read ZIP archive: %v", err)
	}

	foundManifest := false
	foundEML := false
	for _, f := range zipReader.File {
		if f.Name == "manifest.json" {
			foundManifest = true
		}
		if bytes.Contains([]byte(f.Name), []byte(".eml")) {
			foundEML = true
		}
	}

	if !foundManifest {
		t.Errorf("expected manifest.json inside ZIP")
	}
	if !foundEML {
		t.Errorf("expected .eml file inside ZIP")
	}
}

func TestChaosConfigEndpoint(t *testing.T) {
	server, _, _, broker, _, chaos := setupTestServer()
	defer broker.Close()

	// Initial state: chaos disabled
	reqGet := httptest.NewRequest(http.MethodGet, "/api/chaos/config", nil)
	wGet := httptest.NewRecorder()
	server.mux.ServeHTTP(wGet, reqGet)

	if wGet.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", wGet.Code)
	}
	var cfg smtp.ChaosConfig
	_ = json.Unmarshal(wGet.Body.Bytes(), &cfg)
	if cfg.Enabled {
		t.Fatalf("expected chaos to be disabled initially")
	}

	// Enable chaos with 200ms latency and 421 code
	newCfg := smtp.ChaosConfig{
		Enabled:     true,
		LatencyMs:   250,
		FailureRate: 50,
		ErrorCode:   421,
	}
	body, _ := json.Marshal(newCfg)
	reqPost := httptest.NewRequest(http.MethodPost, "/api/chaos/config", bytes.NewReader(body))
	wPost := httptest.NewRecorder()
	server.mux.ServeHTTP(wPost, reqPost)

	if wPost.Code != http.StatusOK {
		t.Fatalf("expected 200 from POST /api/chaos/config, got %d", wPost.Code)
	}

	curCfg := chaos.GetConfig()
	if !curCfg.Enabled || curCfg.LatencyMs != 250 || curCfg.ErrorCode != 421 {
		t.Errorf("unexpected chaos config after update: %+v", curCfg)
	}
}
