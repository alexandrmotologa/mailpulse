package smtp

import (
	"errors"

	"github.com/emersion/go-sasl"
)

// LoginServer implements the non-standard SASL LOGIN mechanism.
type LoginServer struct {
	step int
}

func (s *LoginServer) Next(challenge []byte) ([]byte, bool, error) {
	s.step++
	switch s.step {
	case 1:
		// Challenge for username (User Name)
		return []byte("User Name"), true, nil
	case 2:
		// Challenge for password
		return []byte("Password"), true, nil
	case 3:
		// Accepted!
		return nil, false, nil
	default:
		return nil, false, errors.New("unexpected SASL LOGIN step")
	}
}

// NewAuthServer returns an authenticator accepting any credentials for development.
func NewAuthServer(mech string) (sasl.Server, error) {
	switch mech {
	case sasl.Plain:
		return sasl.NewPlainServer(func(identity, username, password string) error {
			return nil
		}), nil
	case sasl.Anonymous:
		return sasl.NewAnonymousServer(func(trace string) error {
			return nil
		}), nil
	case sasl.Login:
		return &LoginServer{}, nil
	default:
		return nil, sasl.ErrUnexpectedClientResponse
	}
}
