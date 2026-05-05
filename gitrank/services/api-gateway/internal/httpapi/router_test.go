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

	"github.com/Ayush3941/gitrank/packages/authkit"
	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func TestProxyPublicProfileRequest(t *testing.T) {
	type observedRequest struct {
		Method string `json:"method"`
		Path   string `json:"path"`
	}

	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(observedRequest{
			Method: r.Method,
			Path:   r.URL.Path,
		})
	}))
	defer profile.Close()

	router := NewRouter(testConfig(profile.URL, stubAuthServer().URL, stubIngestorServer().URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodGet, "/v1/users/Ayush3941", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if response.Header().Get("Cache-Control") != "public, max-age=60, stale-while-revalidate=300" {
		t.Fatalf("cache-control = %q", response.Header().Get("Cache-Control"))
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

func TestProxyPrivateProfilePatchForwardsRotatedCookiesAndCSRF(t *testing.T) {
	type observedRequest struct {
		Cookie    string `json:"cookie"`
		CSRFToken string `json:"csrf_token"`
		Body      string `json:"body"`
	}

	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{Name: "gitrank_session", Value: "session-rotated", Path: "/"})
		http.SetCookie(w, &http.Cookie{Name: "gitrank_csrf", Value: "csrf-rotated", Path: "/"})
		_ = json.NewEncoder(w).Encode(contracts.SessionEnvelope{
			Session: contracts.SessionIdentity{
				Subject:     "user-1",
				GitHubLogin: "octocat",
				Roles:       []string{"user"},
			},
		})
	}))
	defer auth.Close()

	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, _ := io.ReadAll(r.Body)
		_ = json.NewEncoder(w).Encode(observedRequest{
			Cookie:    r.Header.Get("Cookie"),
			CSRFToken: r.Header.Get("X-CSRF-Token"),
			Body:      string(payload),
		})
	}))
	defer profile.Close()

	router := NewRouter(testConfig(profile.URL, auth.URL, stubIngestorServer().URL), testLogger(), "test")
	body := strings.NewReader(`{"public_profile_enabled":false}`)
	request := httptest.NewRequest(http.MethodPatch, "/v1/me/profile", body)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-original; gitrank_csrf=csrf-original")
	request.Header.Set("X-CSRF-Token", "csrf-original")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if len(response.Result().Cookies()) != 2 {
		t.Fatalf("cookies len = %d, want 2", len(response.Result().Cookies()))
	}

	var observed observedRequest
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !strings.Contains(observed.Cookie, "gitrank_session=session-rotated") {
		t.Fatalf("cookie header = %q, want rotated session token", observed.Cookie)
	}
	if observed.CSRFToken != "csrf-rotated" {
		t.Fatalf("csrf token = %q, want %q", observed.CSRFToken, "csrf-rotated")
	}
	if observed.Body != `{"public_profile_enabled":false}` {
		t.Fatalf("body = %q, want original patch payload", observed.Body)
	}
}

func TestSyncRouteDefaultsToAuthenticatedGitHubLogin(t *testing.T) {
	auth := stubAuthServer()
	defer auth.Close()

	ingestor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body contracts.SyncRequest
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(contracts.GitHubQueuePreview{
			Status:        "queued",
			JobIDs:        []string{"job-1"},
			QueueName:     "github-sync",
			CorrelationID: r.URL.Path + ":" + body.User,
			AcceptedAt:    time.Date(2026, 5, 5, 15, 4, 0, 0, time.UTC),
		})
	}))
	defer ingestor.Close()

	router := NewRouter(testConfig(stubProfileServer().URL, auth.URL, ingestor.URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/sync", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-original; gitrank_csrf=csrf-original")
	csrfToken, err := authkit.DoubleSubmitCSRFFromToken([]byte("test-session-secret"), "session-original")
	if err != nil {
		t.Fatalf("csrf token: %v", err)
	}
	request.Header.Set("X-CSRF-Token", csrfToken)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusAccepted, response.Body.String())
	}

	var observed contracts.SyncResponse
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if observed.Status != "queued" {
		t.Fatalf("status = %q, want %q", observed.Status, "queued")
	}
	if observed.JobID != "job-1" {
		t.Fatalf("job_id = %q, want %q", observed.JobID, "job-1")
	}
	if observed.CorrelationID != "/v1/sync/user:octocat" {
		t.Fatalf("correlation_id = %q, want %q", observed.CorrelationID, "/v1/sync/user:octocat")
	}
}

func TestSyncRouteRejectsInvalidCSRF(t *testing.T) {
	router := NewRouter(testConfig(stubProfileServer().URL, stubAuthServer().URL, stubIngestorServer().URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/sync", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-original; gitrank_csrf=csrf-original")
	request.Header.Set("X-CSRF-Token", "csrf-invalid")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusForbidden, response.Body.String())
	}
}

func testConfig(profileBaseURL, authBaseURL, ingestorBaseURL string) config.App {
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
			AuthBaseURL:           authBaseURL,
			GitHubIngestorBaseURL: ingestorBaseURL,
			ProfileBaseURL:        profileBaseURL,
			RequestTimeout:        time.Second,
		},
		Auth: config.Auth{
			SessionCookieName: "gitrank_session",
			CSRFCookieName:    "gitrank_csrf",
			SessionSecret:     "test-session-secret",
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

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func stubAuthServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(contracts.SessionEnvelope{
			Session: contracts.SessionIdentity{
				Subject:     "user-1",
				GitHubLogin: "octocat",
				Roles:       []string{"user"},
			},
		})
	}))
}

func stubProfileServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
}

func stubIngestorServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":"queued"}`))
	}))
}
