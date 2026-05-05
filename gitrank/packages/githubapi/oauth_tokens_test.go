package githubapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExchangeUserAccessToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %q, want POST", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
			t.Fatalf("content-type = %q", r.Header.Get("Content-Type"))
		}
		if r.Header.Get("Accept") != "application/json" {
			t.Fatalf("accept = %q", r.Header.Get("Accept"))
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("ParseForm() error = %v", err)
		}
		if r.PostForm.Get("client_id") != "client-id" {
			t.Fatalf("client_id = %q", r.PostForm.Get("client_id"))
		}
		if r.PostForm.Get("client_secret") != "client-secret" {
			t.Fatalf("client_secret = %q", r.PostForm.Get("client_secret"))
		}
		if r.PostForm.Get("code") != "auth-code" {
			t.Fatalf("code = %q", r.PostForm.Get("code"))
		}
		if r.PostForm.Get("redirect_uri") != "https://example.com/callback" {
			t.Fatalf("redirect_uri = %q", r.PostForm.Get("redirect_uri"))
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token":             "access-token",
			"token_type":               "bearer",
			"scope":                    "read:user,user:email",
			"expires_in":               3600,
			"refresh_token":            "refresh-token",
			"refresh_token_expires_in": 7200,
		})
	}))
	defer server.Close()

	token, err := ExchangeUserAccessToken(context.Background(), server.Client(), server.URL, UserAccessTokenRequest{
		ClientID:     "client-id",
		ClientSecret: "client-secret",
		Code:         "auth-code",
		RedirectURL:  "https://example.com/callback",
	})
	if err != nil {
		t.Fatalf("ExchangeUserAccessToken() error = %v", err)
	}
	if token.AccessToken != "access-token" {
		t.Fatalf("access token = %q, want access-token", token.AccessToken)
	}
	if token.RefreshToken != "refresh-token" {
		t.Fatalf("refresh token = %q, want refresh-token", token.RefreshToken)
	}
	if token.ExpiresIn.Hours() != 1 {
		t.Fatalf("expires_in = %v, want 1h", token.ExpiresIn)
	}
}

func TestRefreshUserAccessToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("ParseForm() error = %v", err)
		}
		if r.PostForm.Get("grant_type") != "refresh_token" {
			t.Fatalf("grant_type = %q, want refresh_token", r.PostForm.Get("grant_type"))
		}
		if r.PostForm.Get("refresh_token") != "refresh-token" {
			t.Fatalf("refresh_token = %q", r.PostForm.Get("refresh_token"))
		}
		if r.PostForm.Get("client_id") != "client-id" {
			t.Fatalf("client_id = %q", r.PostForm.Get("client_id"))
		}
		if r.PostForm.Get("client_secret") != "client-secret" {
			t.Fatalf("client_secret = %q", r.PostForm.Get("client_secret"))
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token":             "refreshed-access-token",
			"token_type":               "bearer",
			"scope":                    "read:user",
			"expires_in":               1800,
			"refresh_token":            "new-refresh-token",
			"refresh_token_expires_in": 7200,
		})
	}))
	defer server.Close()

	token, err := RefreshUserAccessToken(context.Background(), server.Client(), server.URL, "client-id", "client-secret", "refresh-token")
	if err != nil {
		t.Fatalf("RefreshUserAccessToken() error = %v", err)
	}
	if token.AccessToken != "refreshed-access-token" {
		t.Fatalf("access token = %q, want refreshed-access-token", token.AccessToken)
	}
	if token.RefreshToken != "new-refresh-token" {
		t.Fatalf("refresh token = %q, want new-refresh-token", token.RefreshToken)
	}
}
