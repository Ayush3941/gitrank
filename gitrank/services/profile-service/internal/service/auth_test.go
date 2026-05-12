package service

import (
	"testing"

	"github.com/gitrank/gitrank/packages/authkit"
)

func TestValidateCSRFAcceptsPreviousSessionSecret(t *testing.T) {
	svc := &Service{
		sessionSecrets: [][]byte{[]byte("current-secret"), []byte("previous-secret")},
	}
	csrf, err := authkit.DoubleSubmitCSRFFromToken([]byte("previous-secret"), "session-token")
	if err != nil {
		t.Fatalf("DoubleSubmitCSRFFromToken() error = %v", err)
	}

	if err := svc.validateCSRF("session-token", csrf); err != nil {
		t.Fatalf("validateCSRF() error = %v", err)
	}
}
