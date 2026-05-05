package githubapi

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type AppAuthenticator struct {
	AppID      string
	PrivateKey *rsa.PrivateKey
	TTL        time.Duration
	Now        func() time.Time
}

func NewAppAuthenticator(appID, pemPath string, ttl time.Duration) (*AppAuthenticator, error) {
	if strings.TrimSpace(appID) == "" {
		return nil, errors.New("GitHub App ID is required")
	}
	if strings.TrimSpace(pemPath) == "" {
		return nil, errors.New("GitHub App private key path is required")
	}
	privateKey, err := LoadRSAPrivateKeyFromPEMFile(pemPath)
	if err != nil {
		return nil, err
	}
	if ttl <= 0 {
		ttl = 9 * time.Minute
	}
	return &AppAuthenticator{
		AppID:      strings.TrimSpace(appID),
		PrivateKey: privateKey,
		TTL:        ttl,
		Now:        time.Now,
	}, nil
}

func (a *AppAuthenticator) Token(_ context.Context) (string, error) {
	if a == nil {
		return "", errors.New("app authenticator is required")
	}
	return GenerateAppJWT(a.AppID, a.PrivateKey, a.Now().UTC(), a.TTL)
}

func GenerateAppJWT(appID string, privateKey *rsa.PrivateKey, now time.Time, ttl time.Duration) (string, error) {
	if strings.TrimSpace(appID) == "" {
		return "", errors.New("GitHub App ID is required")
	}
	if privateKey == nil {
		return "", errors.New("GitHub App private key is required")
	}
	if ttl <= 0 {
		return "", errors.New("JWT ttl must be positive")
	}

	header := map[string]string{
		"alg": "RS256",
		"typ": "JWT",
	}
	payload := map[string]any{
		"iat": now.Unix() - 60,
		"exp": now.Add(ttl).Unix(),
		"iss": strings.TrimSpace(appID),
	}

	headerBytes, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	unsigned := encodeSegment(headerBytes) + "." + encodeSegment(payloadBytes)
	sum := crypto.SHA256.New()
	_, _ = sum.Write([]byte(unsigned))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, sum.Sum(nil))
	if err != nil {
		return "", err
	}

	return unsigned + "." + encodeSegment(signature), nil
}

func LoadRSAPrivateKeyFromPEMFile(path string) (*rsa.PrivateKey, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read GitHub App private key: %w", err)
	}
	return LoadRSAPrivateKeyFromPEM(contents)
}

func LoadRSAPrivateKeyFromPEM(contents []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(contents)
	if block == nil {
		return nil, errors.New("invalid PEM private key")
	}

	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse RSA private key: %w", err)
	}

	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("private key is not RSA")
	}
	return rsaKey, nil
}

func encodeSegment(value []byte) string {
	return base64.RawURLEncoding.EncodeToString(value)
}
