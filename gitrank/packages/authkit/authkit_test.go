package authkit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestParseBearerToken(t *testing.T) {
	got, err := ParseBearerToken("Bearer token-123")
	if err != nil {
		t.Fatalf("ParseBearerToken() error = %v", err)
	}
	if got != "token-123" {
		t.Fatalf("ParseBearerToken() = %q, want token-123", got)
	}
}

func TestStateTokenRoundTrip(t *testing.T) {
	secret := []byte("super-secret")
	now := time.Now().UTC()

	token, err := NewStateToken(secret, "nonce-1", 5*time.Minute, now)
	if err != nil {
		t.Fatalf("NewStateToken() error = %v", err)
	}

	claims, err := ValidateStateToken(secret, token, now)
	if err != nil {
		t.Fatalf("ValidateStateToken() error = %v", err)
	}
	if claims.Nonce != "nonce-1" {
		t.Fatalf("Nonce = %q, want nonce-1", claims.Nonce)
	}
}

func TestBearerMiddleware(t *testing.T) {
	authenticator := func(_ context.Context, token string) (*Principal, error) {
		return &Principal{Subject: token}, nil
	}

	handler := Bearer(authenticator)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := PrincipalFromContext(r.Context())
		if !ok {
			t.Fatal("principal missing from context")
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(principal.Subject))
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer user-1")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if rec.Body.String() != "user-1" {
		t.Fatalf("body = %q, want user-1", rec.Body.String())
	}
}

func TestOpaqueTokenRoundTrip(t *testing.T) {
	token, err := NewOpaqueToken(32)
	if err != nil {
		t.Fatalf("NewOpaqueToken() error = %v", err)
	}
	if token == "" {
		t.Fatal("NewOpaqueToken() returned empty token")
	}

	hash, err := HashOpaqueToken([]byte("session-secret"), token)
	if err != nil {
		t.Fatalf("HashOpaqueToken() error = %v", err)
	}
	if hash == "" {
		t.Fatal("HashOpaqueToken() returned empty hash")
	}
}

func TestEncryptDecryptSecret(t *testing.T) {
	key, err := DecodeBase64Key("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
	if err != nil {
		t.Fatalf("DecodeBase64Key() error = %v", err)
	}

	encrypted, err := EncryptSecret(key, "ghu_example_token")
	if err != nil {
		t.Fatalf("EncryptSecret() error = %v", err)
	}
	if encrypted == "" {
		t.Fatal("EncryptSecret() returned empty ciphertext")
	}

	decrypted, err := DecryptSecret(key, encrypted)
	if err != nil {
		t.Fatalf("DecryptSecret() error = %v", err)
	}
	if decrypted != "ghu_example_token" {
		t.Fatalf("DecryptSecret() = %q, want ghu_example_token", decrypted)
	}
}

func TestSameSiteAndCookies(t *testing.T) {
	rec := httptest.NewRecorder()
	SetCookie(rec, CookieConfig{
		Name:     "session",
		Value:    "abc",
		Path:     "/",
		HTTPOnly: true,
		Secure:   true,
		SameSite: SameSiteFromString("strict"),
	})

	result := rec.Result()
	cookies := result.Cookies()
	if len(cookies) != 1 {
		t.Fatalf("cookies len = %d, want 1", len(cookies))
	}
	if cookies[0].SameSite != http.SameSiteStrictMode {
		t.Fatalf("SameSite = %v, want strict", cookies[0].SameSite)
	}
}

func TestRequireRolesMiddleware(t *testing.T) {
	handler := RequireRoles("admin")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(ContextWithPrincipal(req.Context(), Principal{
		Subject: "user-1",
		Roles:   []string{"user", "admin"},
	}))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
}

func TestRequireRolesRejectsMissingRole(t *testing.T) {
	handler := RequireRoles("admin")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(ContextWithPrincipal(req.Context(), Principal{
		Subject: "user-1",
		Roles:   []string{"user"},
	}))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
}
