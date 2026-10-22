package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Event represents a Server-Sent Event sent to clients.
type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// SSEBroker coordinates real-time event streaming over HTTP.
type SSEBroker struct {
	mu         sync.Mutex
	clients    map[chan Event]struct{}
	register   chan chan Event
	unregister chan chan Event
	broadcast  chan Event
	stop       chan struct{}
}

// NewSSEBroker initializes an event broker.
func NewSSEBroker() *SSEBroker {
	b := &SSEBroker{
		clients:    make(map[chan Event]struct{}),
		register:   make(chan chan Event),
		unregister: make(chan chan Event),
		broadcast:  make(chan Event, 100),
		stop:       make(chan struct{}),
	}
	go b.run()
	return b
}

func (b *SSEBroker) run() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-b.stop:
			b.mu.Lock()
			for ch := range b.clients {
				close(ch)
			}
			b.clients = nil
			b.mu.Unlock()
			return

		case client := <-b.register:
			b.mu.Lock()
			b.clients[client] = struct{}{}
			b.mu.Unlock()

		case client := <-b.unregister:
			b.mu.Lock()
			if _, ok := b.clients[client]; ok {
				delete(b.clients, client)
				close(client)
			}
			b.mu.Unlock()

		case event := <-b.broadcast:
			b.mu.Lock()
			for ch := range b.clients {
				select {
				case ch <- event:
				default:
					// Slow client buffer full, drop to prevent blocking
				}
			}
			b.mu.Unlock()

		case <-ticker.C:
			// Send heartbeat comment to keep HTTP connections open
			b.mu.Lock()
			for ch := range b.clients {
				select {
				case ch <- Event{Type: "ping", Data: "keepalive"}:
				default:
				}
			}
			b.mu.Unlock()
		}
	}
}

// Broadcast sends an event to all connected listeners.
func (b *SSEBroker) Broadcast(eventType string, data interface{}) {
	b.broadcast <- Event{
		Type: eventType,
		Data: data,
	}
}

// Close terminates the broker.
func (b *SSEBroker) Close() {
	close(b.stop)
}

// ServeHTTP handles incoming SSE connection requests.
func (b *SSEBroker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	clientChan := make(chan Event, 10)
	b.register <- clientChan
	defer func() {
		b.unregister <- clientChan
	}()

	// Send initial handshake
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"ok\"}\n\n")
	flusher.Flush()

	notify := r.Context().Done()
	for {
		select {
		case <-notify:
			return
		case event, ok := <-clientChan:
			if !ok {
				return
			}
			if event.Type == "ping" {
				fmt.Fprintf(w, ": keepalive\n\n")
				flusher.Flush()
				continue
			}
			payload, err := json.Marshal(event.Data)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, payload)
			flusher.Flush()
		}
	}
}
