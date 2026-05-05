package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
)

func TestProxyPublicProfileRequest(t *testing.T) {
	type observedRequest struct {
		Method string `json:"method"`
		Path   string `json:"path"`
	}

	downstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(observedRequest{
			Method: r.Method,
			Path:   r.URL.Path,
		})
	}))
	defer downstream.Close()

	router := NewRouter(testConfig(downstream.URL), slog.New(slog.NewTextHandler(io.Discard, nil)), "test")
	request := httptest.NewRequest(http.MethodGet, "/v1/users/Ayush3941", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}

	var observed observedRequest
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if observed.Method != http.MethodGet {
		t.Fatalf("method = %q, want %q", observed.Method, http.MethodGet)
	}
	if observed.Path != "/v1/users/Ayush3941" {
		t.Fatalf("path = %q, want %q", observed.Path, "/v1/users/Ayush3941")
	}
}

func TestProxyPrivateProfilePatchForwardsCookiesAndCSRF(t *testing.T) {
	type observedRequest struct {
		Cookie    string `json:"cookie"`
		CSRFToken string `json:"csrf_token"`
		Body      string `json:"body"`
	}

	downstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, _ := io.ReadAll(r.Body)
		_ = json.NewEncoder(w).Encode(observedRequest{
			Cookie:    r.Header.Get("Cookie"),
			CSRFToken: r.Header.Get("X-CSRF-Token"),
			Body:      string(payload),
		})
	}))
	defer downstream.Close()

	router := NewRouter(testConfig(downstream.URL), slog.New(slog.NewTextHandler(io.Discard, nil)), "test")
	body := strings.NewReader(`{"public_profile_enabled":false}`)
	request := httptest.NewRequest(http.MethodPatch, "/v1/me/profile", body)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-value; gitrank_csrf=csrf-cookie")
	request.Header.Set("X-CSRF-Token", "csrf-cookie")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}

	var observed observedRequest
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !strings.Contains(observed.Cookie, "gitrank_session=session-value") {
		t.Fatalf("cookie header = %q, want session token", observed.Cookie)
	}
	if observed.CSRFToken != "csrf-cookie" {
		t.Fatalf("csrf token = %q, want %q", observed.CSRFToken, "csrf-cookie")
	}
	if observed.Body != `{"public_profile_enabled":false}` {
		t.Fatalf("body = %q, want original patch payload", observed.Body)
	}
}

func testConfig(profileBaseURL string) config.App {
	return config.App{
		ServiceName: "api-gateway",
		Env:         config.Development,
		Addr:        ":8080",
		Log: config.Log{
			Level:  "info",
			Format: "text",
		},
		ShutdownTimeout: time.Second,
		PublicBaseURL:   "http://localhost:3000",
		APIBaseURL:      "http://localhost:8080",
		Services: config.Services{
			ProfileBaseURL: profileBaseURL,
			RequestTimeout: time.Second,
		},
		GitHub: config.GitHub{
			AuthorizeURL:    "https://github.com/login/oauth/authorize",
			TokenURL:        "https://github.com/login/oauth/access_token",
			DeviceURL:       "https://github.com/login/device/code",
			APIBaseURL:      "https://api.github.com",
			GraphQLURL:      "https://api.github.com/graphql",
			RequestTimeout:  time.Second,
			MaxPageSize:     100,
			GraphQLPageSize: 100,
		},
		AI: config.AI{
			BaseURL:        "https://api.openai.com/v1",
			RequestTimeout: time.Second,
		},
		Scheduler: config.Scheduler{
			MaxAttempts:  1,
			RetryBackoff: time.Second,
		},
	}
}
