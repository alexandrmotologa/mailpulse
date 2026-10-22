package smtp

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/emersion/go-smtp"
)

// ChaosConfig defines parameters for simulated SMTP network failures and latency.
type ChaosConfig struct {
	Enabled      bool   `json:"enabled"`
	LatencyMs    int    `json:"latencyMs"`
	FailureRate  int    `json:"failureRate"` // 0 - 100 percentage
	ErrorCode    int    `json:"errorCode"`   // e.g. 421, 450, 550, 554
	ErrorMessage string `json:"errorMessage"`
}

// ChaosManager handles thread-safe chaos configuration.
type ChaosManager struct {
	mu     sync.RWMutex
	config ChaosConfig
}

// NewChaosManager initializes chaos configuration.
func NewChaosManager() *ChaosManager {
	return &ChaosManager{
		config: ChaosConfig{
			Enabled:      false,
			LatencyMs:    0,
			FailureRate:  0,
			ErrorCode:    421,
			ErrorMessage: "4.3.0 MailPulse Chaos: Temporary service failure",
		},
	}
}

// GetConfig returns current chaos parameters.
func (cm *ChaosManager) GetConfig() ChaosConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.config
}

// SetConfig updates chaos parameters.
func (cm *ChaosManager) SetConfig(cfg ChaosConfig) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	if cfg.ErrorCode <= 0 {
		cfg.ErrorCode = 421
	}
	if cfg.ErrorMessage == "" {
		cfg.ErrorMessage = "4.3.0 MailPulse Chaos: Temporary service failure"
	}
	cm.config = cfg
}

// MaybeInject applies latency and tests if a failure should trigger.
func (cm *ChaosManager) MaybeInject() error {
	cm.mu.RLock()
	cfg := cm.config
	cm.mu.RUnlock()

	if !cfg.Enabled {
		return nil
	}

	// Apply latency if configured
	if cfg.LatencyMs > 0 {
		time.Sleep(time.Duration(cfg.LatencyMs) * time.Millisecond)
	}

	// Test failure rate
	if cfg.FailureRate > 0 {
		roll := rand.Intn(100)
		if roll < cfg.FailureRate {
			return &smtp.SMTPError{
				Code:         cfg.ErrorCode,
				EnhancedCode: smtp.EnhancedCode{4, 3, 0},
				Message:      fmt.Sprintf("%s (Chaos Injected)", cfg.ErrorMessage),
			}
		}
	}

	return nil
}
