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
	"github.com/Ayush3941/gitrank/services/api-gateway/internal/app"
)

func TestManifestAndDependenciesRoutes(t *testing.T) {
	cfg := testConfig(stubProfileServer().URL, stubAuthServer().URL, stubIngestorServer().URL)
	router := NewRouter(cfg, testLogger(), "test")

	manifestResponse := httptest.NewRecorder()
	router.ServeHTTP(manifestResponse, httptest.NewRequest(http.MethodGet, "/v1/meta/manifest", nil))
	if manifestResponse.Code != http.StatusOK {
		t.Fatalf("manifest status = %d, want %d", manifestResponse.Code, http.StatusOK)
	}

	var manifest contracts.ServiceManifest
	if err := json.Unmarshal(manifestResponse.Body.Bytes(), &manifest); err != nil {
		t.Fatalf("unmarshal manifest: %v", err)
	}
	if manifest.Service != "api-gateway" {
		t.Fatalf("manifest service = %q, want %q", manifest.Service, "api-gateway")
	}

	dependenciesResponse := httptest.NewRecorder()
	router.ServeHTTP(dependenciesResponse, httptest.NewRequest(http.MethodGet, "/v1/meta/dependencies", nil))
	if dependenciesResponse.Code != http.StatusOK {
		t.Fatalf("dependencies status = %d, want %d", dependenciesResponse.Code, http.StatusOK)
	}

	var dependencies []contracts.DependencySpec
	if err := json.Unmarshal(dependenciesResponse.Body.Bytes(), &dependencies); err != nil {
		t.Fatalf("unmarshal dependencies: %v", err)
	}
	expected := app.Manifest(cfg, "test").Dependencies
	if len(dependencies) != len(expected) {
		t.Fatalf("dependency count = %d, want %d", len(dependencies), len(expected))
	}
	if dependencies[0].Name != expected[0].Name {
		t.Fatalf("first dependency = %q, want %q", dependencies[0].Name, expected[0].Name)
	}
}

func TestCORSPreflightAllowsConfiguredOrigin(t *testing.T) {
	router := NewRouter(testConfig(stubProfileServer().URL, stubAuthServer().URL, stubIngestorServer().URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodOptions, "/v1/sync", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	if response.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Fatalf("allow-origin = %q", response.Header().Get("Access-Control-Allow-Origin"))
	}
	if response.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("allow-credentials = %q", response.Header().Get("Access-Control-Allow-Credentials"))
	}
}

func TestProxyPublicProfileRequest(t *testing.T) {
	type observedRequest struct {
		Method      string `json:"method"`
		Path        string `json:"path"`
		TraceParent string `json:"trace_parent"`
	}

	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(observedRequest{
			Method:      r.Method,
			Path:        r.URL.Path,
			TraceParent: r.Header.Get("traceparent"),
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
	if observed.TraceParent == "" {
		t.Fatal("traceparent header missing")
	}
}

func TestProxyPrivateProfileGetSetsPrivateCacheControl(t *testing.T) {
	auth := stubAuthServer()
	defer auth.Close()

	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=120")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer profile.Close()

	router := NewRouter(testConfig(profile.URL, auth.URL, stubIngestorServer().URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodGet, "/v1/me/profile", nil)
	request.Header.Set("Cookie", "gitrank_session=session-original")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if response.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("cache-control = %q, want private, no-store", response.Header().Get("Cache-Control"))
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

	var forwardedSubject string
	var forwardedGitHubLogin string
	ingestor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body contracts.SyncRequest
		_ = json.NewDecoder(r.Body).Decode(&body)
		forwardedSubject = r.Header.Get("X-GitRank-Subject")
		forwardedGitHubLogin = r.Header.Get("X-GitRank-GitHub-Login")
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
	if forwardedSubject != "user-1" {
		t.Fatalf("X-GitRank-Subject = %q, want %q", forwardedSubject, "user-1")
	}
	if forwardedGitHubLogin != "octocat" {
		t.Fatalf("X-GitRank-GitHub-Login = %q, want %q", forwardedGitHubLogin, "octocat")
	}
}

func TestRepositorySyncExecutionRouteProxiesExecutionContract(t *testing.T) {
	auth := stubAuthServer()
	defer auth.Close()

	var observedPath string
	var observedBody contracts.SyncRequest
	var forwardedSubject string
	var forwardedGitHubLogin string
	ingestor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedPath = r.URL.Path
		forwardedSubject = r.Header.Get("X-GitRank-Subject")
		forwardedGitHubLogin = r.Header.Get("X-GitRank-GitHub-Login")
		_ = json.NewDecoder(r.Body).Decode(&observedBody)
		_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
			Status:        "completed",
			Mode:          "repository",
			Repository:    "octo/repo",
			CorrelationID: "req-1",
			StartedAt:     time.Date(2026, 5, 6, 10, 0, 0, 0, time.UTC),
			FinishedAt:    time.Date(2026, 5, 6, 10, 0, 3, 0, time.UTC),
			Fetched:       map[string]int{"repositories": 1, "pull_requests": 2},
			Persisted:     map[string]int{"repositories": 1, "pull_requests": 2},
		})
	}))
	defer ingestor.Close()

	router := NewRouter(testConfig(stubProfileServer().URL, auth.URL, ingestor.URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/sync/repository/execute", strings.NewReader(`{"repository":"octo/repo"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-original; gitrank_csrf=csrf-original")
	csrfToken, err := authkit.DoubleSubmitCSRFFromToken([]byte("test-session-secret"), "session-original")
	if err != nil {
		t.Fatalf("csrf token: %v", err)
	}
	request.Header.Set("X-CSRF-Token", csrfToken)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if observedPath != "/v1/sync/repository/execute" {
		t.Fatalf("path = %q, want %q", observedPath, "/v1/sync/repository/execute")
	}
	if observedBody.Mode != "repository" || observedBody.Repository != "octo/repo" {
		t.Fatalf("observed body = %+v, want repository sync request", observedBody)
	}
	if forwardedSubject != "user-1" {
		t.Fatalf("X-GitRank-Subject = %q, want %q", forwardedSubject, "user-1")
	}
	if forwardedGitHubLogin != "octocat" {
		t.Fatalf("X-GitRank-GitHub-Login = %q, want %q", forwardedGitHubLogin, "octocat")
	}

	var observed contracts.GitHubSyncExecutionResponse
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if observed.Status != "completed" || observed.Repository != "octo/repo" {
		t.Fatalf("execution response = %+v", observed)
	}
}

func TestRepositorySyncExecutionRejectsUnsafeRepository(t *testing.T) {
	auth := stubAuthServer()
	defer auth.Close()
	ingestor := stubIngestorServer()
	defer ingestor.Close()

	router := NewRouter(testConfig(stubProfileServer().URL, auth.URL, ingestor.URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/sync/repository/execute", strings.NewReader(`{"repository":"https://github.com/octo/repo"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-original; gitrank_csrf=csrf-original")
	csrfToken, err := authkit.DoubleSubmitCSRFFromToken([]byte("test-session-secret"), "session-original")
	if err != nil {
		t.Fatalf("csrf token: %v", err)
	}
	request.Header.Set("X-CSRF-Token", csrfToken)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusBadRequest, response.Body.String())
	}
}

func TestInstallationSyncExecutionRouteProxiesExecutionContract(t *testing.T) {
	auth := stubAuthServer()
	defer auth.Close()

	var observedPath string
	var observedBody contracts.SyncRequest
	var forwardedSubject string
	var forwardedGitHubLogin string
	ingestor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedPath = r.URL.Path
		forwardedSubject = r.Header.Get("X-GitRank-Subject")
		forwardedGitHubLogin = r.Header.Get("X-GitRank-GitHub-Login")
		_ = json.NewDecoder(r.Body).Decode(&observedBody)
		_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
			Status:        "completed",
			Mode:          "installation",
			Installation:  42,
			CorrelationID: "req-2",
			StartedAt:     time.Date(2026, 5, 6, 10, 0, 0, 0, time.UTC),
			FinishedAt:    time.Date(2026, 5, 6, 10, 0, 4, 0, time.UTC),
			Fetched:       map[string]int{"repositories_selected": 2},
			Persisted:     map[string]int{"repositories": 2},
		})
	}))
	defer ingestor.Close()

	router := NewRouter(testConfig(stubProfileServer().URL, auth.URL, ingestor.URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/sync/installation/execute", strings.NewReader(`{"installation_id":42}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-original; gitrank_csrf=csrf-original")
	csrfToken, err := authkit.DoubleSubmitCSRFFromToken([]byte("test-session-secret"), "session-original")
	if err != nil {
		t.Fatalf("csrf token: %v", err)
	}
	request.Header.Set("X-CSRF-Token", csrfToken)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if observedPath != "/v1/sync/installation/execute" {
		t.Fatalf("path = %q, want %q", observedPath, "/v1/sync/installation/execute")
	}
	if observedBody.Mode != "installation" || observedBody.InstallationID != 42 {
		t.Fatalf("observed body = %+v, want installation sync request", observedBody)
	}
	if forwardedSubject != "user-1" {
		t.Fatalf("X-GitRank-Subject = %q, want %q", forwardedSubject, "user-1")
	}
	if forwardedGitHubLogin != "octocat" {
		t.Fatalf("X-GitRank-GitHub-Login = %q, want %q", forwardedGitHubLogin, "octocat")
	}

	var observed contracts.GitHubSyncExecutionResponse
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if observed.Status != "completed" || observed.Installation != 42 {
		t.Fatalf("execution response = %+v", observed)
	}
}

func TestSyncRoutePropagatesRetryAfterFromUpstream(t *testing.T) {
	auth := stubAuthServer()
	defer auth.Close()

	ingestor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Retry-After", "17")
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(contracts.ErrorResponse{
			Error: contracts.ErrorBody{
				Code:    "rate_limited",
				Message: "upstream limit",
			},
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

	if response.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusTooManyRequests, response.Body.String())
	}
	if response.Header().Get("Retry-After") != "17" {
		t.Fatalf("retry-after = %q, want %q", response.Header().Get("Retry-After"), "17")
	}
	if response.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("cache-control = %q, want private, no-store", response.Header().Get("Cache-Control"))
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

func TestAccountUnlinkRouteForwardsCookiesAndPrivateCacheControl(t *testing.T) {
	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/session/me":
			_ = json.NewEncoder(w).Encode(contracts.SessionEnvelope{
				Session: contracts.SessionIdentity{
					Subject:     "user-1",
					GitHubLogin: "octocat",
					Roles:       []string{"user"},
				},
			})
		case "/v1/account/unlink":
			if r.Method != http.MethodPost {
				t.Fatalf("unlink method = %s, want POST", r.Method)
			}
			if r.Header.Get("X-CSRF-Token") == "" {
				t.Fatal("expected CSRF token to be forwarded")
			}
			http.SetCookie(w, &http.Cookie{Name: "gitrank_session", Value: "", Path: "/", MaxAge: -1})
			http.SetCookie(w, &http.Cookie{Name: "gitrank_csrf", Value: "", Path: "/", MaxAge: -1})
			_ = json.NewEncoder(w).Encode(contracts.AccountUnlinkResponse{
				Status:        "unlinked",
				LoggedOut:     true,
				ReauthorizeAt: "http://localhost:3000/login",
			})
		default:
			t.Fatalf("unexpected auth path %s", r.URL.Path)
		}
	}))
	defer auth.Close()

	router := NewRouter(testConfig(stubProfileServer().URL, auth.URL, stubIngestorServer().URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/me/account/unlink", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-original; gitrank_csrf=csrf-original")
	csrfToken, err := authkit.DoubleSubmitCSRFFromToken([]byte("test-session-secret"), "session-original")
	if err != nil {
		t.Fatalf("csrf token: %v", err)
	}
	request.Header.Set("X-CSRF-Token", csrfToken)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if response.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("cache-control = %q, want private, no-store", response.Header().Get("Cache-Control"))
	}
	if len(response.Result().Cookies()) != 2 {
		t.Fatalf("cookies len = %d, want 2", len(response.Result().Cookies()))
	}
}

func TestAccountDeleteRoutePassesThroughDeletionResponse(t *testing.T) {
	deletedAt := time.Date(2026, 5, 5, 16, 0, 0, 0, time.UTC)
	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/session/me":
			_ = json.NewEncoder(w).Encode(contracts.SessionEnvelope{
				Session: contracts.SessionIdentity{
					Subject:     "user-1",
					GitHubLogin: "octocat",
					Roles:       []string{"user"},
				},
			})
		case "/v1/account/delete":
			payload, _ := io.ReadAll(r.Body)
			if string(payload) != `{"confirmation":"DELETE"}` {
				t.Fatalf("delete body = %q, want confirmation payload", string(payload))
			}
			http.SetCookie(w, &http.Cookie{Name: "gitrank_session", Value: "", Path: "/", MaxAge: -1})
			http.SetCookie(w, &http.Cookie{Name: "gitrank_csrf", Value: "", Path: "/", MaxAge: -1})
			_ = json.NewEncoder(w).Encode(contracts.AccountDeletionResponse{
				Status:    "deleted",
				LoggedOut: true,
				DeletedAt: deletedAt,
			})
		default:
			t.Fatalf("unexpected auth path %s", r.URL.Path)
		}
	}))
	defer auth.Close()

	router := NewRouter(testConfig(stubProfileServer().URL, auth.URL, stubIngestorServer().URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/me/account/delete", strings.NewReader(`{"confirmation":"DELETE"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-original; gitrank_csrf=csrf-original")
	csrfToken, err := authkit.DoubleSubmitCSRFFromToken([]byte("test-session-secret"), "session-original")
	if err != nil {
		t.Fatalf("csrf token: %v", err)
	}
	request.Header.Set("X-CSRF-Token", csrfToken)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if len(response.Result().Cookies()) != 2 {
		t.Fatalf("cookies len = %d, want 2", len(response.Result().Cookies()))
	}

	var observed contracts.AccountDeletionResponse
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if observed.Status != "deleted" || !observed.DeletedAt.Equal(deletedAt) {
		t.Fatalf("deletion response = %+v", observed)
	}
}

func TestBuildProxyURLRejectsUnsafeBaseAndPath(t *testing.T) {
	if _, err := buildProxyURL("file://metadata/latest", "/readyz", ""); err == nil {
		t.Fatal("buildProxyURL() error = nil, want unsafe scheme rejection")
	}
	if _, err := buildProxyURL("http://user:pass@internal", "/readyz", ""); err == nil {
		t.Fatal("buildProxyURL() error = nil, want userinfo rejection")
	}
	if _, err := buildProxyURL("http://profile-service", "//evil.example/path", ""); err == nil {
		t.Fatal("buildProxyURL() error = nil, want path-relative URL rejection")
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
