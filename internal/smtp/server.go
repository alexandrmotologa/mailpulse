package smtp

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"fmt"
	"log"
	"math/big"
	"net"
	"time"

	"github.com/alexandrmotologa/mailpulse/internal/mime"
	"github.com/alexandrmotologa/mailpulse/internal/model"
	"github.com/alexandrmotologa/mailpulse/internal/storage"
	"github.com/alexandrmotologa/mailpulse/internal/webhook"
	"github.com/emersion/go-smtp"
)

// Backend implements smtp.Backend.
type Backend struct {
	storage    storage.Storage
	dispatcher *webhook.Dispatcher
	parser     *mime.Parser
	onMessage  func(*model.Message)
}

func (b *Backend) NewSession(c *smtp.Conn) (smtp.Session, error) {
	return &Session{
		backend:    b,
		parser:     b.parser,
		storage:    b.storage,
		dispatcher: b.dispatcher,
		onMessage:  b.onMessage,
	}, nil
}

// Server wraps go-smtp Server instance.
type Server struct {
	smtpServer *smtp.Server
	backend    *Backend
	addr       string
}

// NewServer configures a new SMTP server instance.
func NewServer(host string, port int, store storage.Storage, disp *webhook.Dispatcher, onMsg func(*model.Message), enableTLS bool) (*Server, error) {
	addr := fmt.Sprintf("%s:%d", host, port)

	backend := &Backend{
		storage:    store,
		dispatcher: disp,
		parser:     mime.NewParser(),
		onMessage:  onMsg,
	}

	s := smtp.NewServer(backend)
	s.Addr = addr
	s.Domain = "mailpulse.local"
	s.ReadTimeout = 30 * time.Second
	s.WriteTimeout = 30 * time.Second
	s.MaxMessageBytes = 25 * 1024 * 1024
	s.MaxRecipients = 50
	s.AllowInsecureAuth = true

	if enableTLS {
		tlsConfig, err := generateSelfSignedTLS()
		if err == nil {
			s.TLSConfig = tlsConfig
		} else {
			log.Printf("[SMTP] Warning: could not generate self-signed TLS: %v", err)
		}
	}

	return &Server{
		smtpServer: s,
		backend:    backend,
		addr:       addr,
	}, nil
}

// Start begins listening and serving SMTP connections.
func (s *Server) Start() error {
	log.Printf("[SMTP] Listening on %s ...", s.addr)
	return s.smtpServer.ListenAndServe()
}

// Close gracefully stops the SMTP listener.
func (s *Server) Close() error {
	return s.smtpServer.Close()
}

func generateSelfSignedTLS() (*tls.Config, error) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject: pkix.Name{
			Organization: []string{"MailPulse Development"},
			CommonName:   "127.0.0.1",
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("0.0.0.0")},
		DNSNames:              []string{"localhost", "mailpulse.local"},
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return nil, err
	}

	cert := tls.Certificate{
		Certificate: [][]byte{derBytes},
		PrivateKey:  priv,
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
	}, nil
}
