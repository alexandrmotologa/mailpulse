package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/alexandrmotologa/mailpulse/internal/sample"
	"github.com/alexandrmotologa/mailpulse/internal/server"
	"github.com/alexandrmotologa/mailpulse/internal/smtp"
	"github.com/alexandrmotologa/mailpulse/internal/storage"
	"github.com/alexandrmotologa/mailpulse/internal/webhook"
)

const version = "1.0.0"

func main() {
	smtpPort := flag.Int("smtp-port", 1025, "Port for incoming SMTP connections")
	webPort := flag.Int("web-port", 8025, "Port for web studio interface and API")
	host := flag.String("host", "127.0.0.1", "Host IP to bind to")
	persist := flag.Bool("persist", false, "Persist captured emails to SQLite")
	dbPath := flag.String("db-path", "mailpulse.db", "File path for SQLite database")
	maxMessages := flag.Int("max-messages", 500, "Maximum in-memory messages to retain")
	webhookURL := flag.String("webhook-url", "", "HTTP URL to forward incoming emails to")
	enableTLS := flag.Bool("tls", false, "Enable STARTTLS with self-signed certificate")
	noOpen := flag.Bool("no-open", false, "Do not automatically open the browser on startup")
	seed := flag.Bool("seed", false, "Seed sample emails into the inbox on startup")
	showVersion := flag.Bool("version", false, "Print version and exit")

	flag.Parse()

	if *showVersion {
		fmt.Printf("MailPulse v%s (%s/%s)\n", version, runtime.GOOS, runtime.GOARCH)
		return
	}

	printBanner(*host, *smtpPort, *webPort, *persist)

	// Initialize storage
	var store storage.Storage
	var err error
	if *persist {
		log.Printf("[Storage] Initializing SQLite store at %s ...", *dbPath)
		store, err = storage.NewSQLiteStore(*dbPath, *smtpPort, *webPort)
		if err != nil {
			log.Fatalf("[Storage] Failed to initialize SQLite store: %v", err)
		}
	} else {
		log.Printf("[Storage] Using in-memory ring buffer (capacity: %d emails) ...", *maxMessages)
		store = storage.NewMemoryStore(*maxMessages, *smtpPort, *webPort)
	}
	defer store.Close()

	if *seed {
		log.Printf("[Storage] Seeding initial sample emails ...")
		seedDemoData(store)
	}

	// Initialize webhook dispatcher
	disp := webhook.NewDispatcher(*webhookURL)
	if *webhookURL != "" {
		log.Printf("[Webhook] Forwarding enabled to %s", *webhookURL)
	}

	// Initialize Server-Sent Events broker
	broker := server.NewSSEBroker()
	defer broker.Close()

	// Initialize long-polling waiter registry for E2E automation
	waiters := server.NewWaiterRegistry()

	// Initialize SMTP chaos simulator
	chaos := smtp.NewChaosManager()

	// Broadcast callback when new emails are captured
	onNewMessage := func(msg *model.Message) {
		broker.Broadcast("new_message", msg.ToSummary())
		waiters.Notify(msg)
	}

	// Start SMTP Daemon
	smtpSrv, err := smtp.NewServer(*host, *smtpPort, store, disp, onNewMessage, *enableTLS, chaos)
	if err != nil {
		log.Fatalf("[SMTP] Failed to initialize SMTP server: %v", err)
	}

	go func() {
		if err := smtpSrv.Start(); err != nil && err != http.ErrServerClosed {
			log.Printf("[SMTP] Listener stopped: %v", err)
		}
	}()
	defer smtpSrv.Close()

	// Start Web API Server
	apiSrv := server.NewAPIServer(*host, *webPort, *smtpPort, store, disp, broker, waiters, chaos)
	go func() {
		if err := apiSrv.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[HTTP] API server error: %v", err)
		}
	}()
	defer apiSrv.Close()

	// Open browser if requested and not in headless/CI environment
	webURL := fmt.Sprintf("http://%s:%d", *host, *webPort)
	if !*noOpen && os.Getenv("CI") == "" {
		go func() {
			time.Sleep(500 * time.Millisecond)
			openBrowser(webURL)
		}()
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	<-sigChan
	fmt.Println("\n[MailPulse] Shutting down gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_ = apiSrv.Close()
	_ = smtpSrv.Close()
	_ = shutdownCtx
	fmt.Println("[MailPulse] Goodbye!")
}

func printBanner(host string, smtpPort, webPort int, persist bool) {
	storageMode := "In-Memory Ring Buffer"
	if persist {
		storageMode = "SQLite Database"
	}

	fmt.Println(`
   __  ___      _ __  ____        __         
  /  |/  /___ _(_) / / __ \__  __/ /_______  
 / /|_/ / __ ` + "`" + `/ / / / /_/ / / / / / ___/ _ \ 
/ /  / / /_/ / / / / ____/ /_/ / (__  )  __/ 
/_/  /_/\__,_/_/_/ /_/    \__,_/_/____/\___/  v` + version + `

============================================================
  SMTP Server:  ` + fmt.Sprintf("%s:%d", host, smtpPort) + ` (Port 1025)
  Web Studio:   ` + fmt.Sprintf("http://%s:%d", host, webPort) + `
  Storage:      ` + storageMode + `
============================================================
Ready to capture local outgoing development emails.
Press Ctrl+C to exit.
`)
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

// SeedDemoData populates initial emails if desired
func seedDemoData(store storage.Storage) {
	ctx := context.Background()
	_ = store.Save(ctx, sample.Generate("otp"))
	_ = store.Save(ctx, sample.Generate("receipt"))
}
