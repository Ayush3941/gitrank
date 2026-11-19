package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/gitrank/gitrank/packages/authkit"
	"github.com/gitrank/gitrank/packages/contracts"
)

func TestPRSummaryAuthorizesBeforeOpeningNonPersistentStream(t *testing.T) {
	for _, tc := range []struct {
		name                             string
		session, csrf, hidden            bool
		reportStatus, wantStatus, wantAI int
	}{
		{"generate", true, true, false, 200, 200, 1},
		{"signed out", false, false, false, 200, 401, 0},
		{"invalid CSRF", true, false, false, 200, 403, 0},
		{"hidden summary", true, true, true, 200, 403, 0},
		{"private report", true, true, false, 404, 404, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if _, err := r.Cookie("gitrank_session"); err != nil {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				_ = json.NewEncoder(w).Encode(contracts.SessionEnvelope{Session: contracts.SessionIdentity{Subject: "user-1", GitHubLogin: "octocat", Roles: []string{"user"}}})
			}))
			defer auth.Close()
			var aiCalls atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/v1/pr/octo/repo/42/report":
					if r.Method != http.MethodGet || !strings.Contains(r.Header.Get("Cookie"), "session-original") {
						t.Error("report access must use the authenticated read path")
					}
					w.WriteHeader(tc.reportStatus)
					visible := !tc.hidden
					_ = json.NewEncoder(w).Encode(contracts.PullRequestReportResponse{AISummaryVisible: &visible})
				case "/v1/analyze/pull-request/summary":
					aiCalls.Add(1)
					var req contracts.SyncRequest
					_ = json.NewDecoder(r.Body).Decode(&req)
					if req.Repository != "octo/repo" || req.Number != 42 {
						t.Errorf("incorrect summary evidence request: %+v", req)
					}
					w.Header().Set("Content-Type", "text/event-stream")
					_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"An explanation.\"}}]}\n\n"))
					w.(http.Flusher).Flush()
					_, _ = w.Write([]byte("data: [DONE]\n\n"))
				default:
					t.Errorf("summary attempted a write/sync route: %s", r.URL.Path)
					w.WriteHeader(500)
				}
			}))
			defer upstream.Close()
			cfg := testConfig(upstream.URL, auth.URL, upstream.URL)
			cfg.Services.PRAnalyzerBaseURL = upstream.URL
			router := NewRouter(cfg, testLogger(), "test")
			req := httptest.NewRequest(http.MethodPost, "/v1/pr/octo/repo/42/summary", strings.NewReader(`{"repository":"ignored/attack","number":1}`))
			req.Header.Set("Content-Type", "application/json")
			if tc.session {
				req.Header.Set("Cookie", "gitrank_session=session-original")
			}
			if tc.csrf {
				csrf, err := authkit.DoubleSubmitCSRFFromToken([]byte(cfg.Auth.SessionSecret), "session-original")
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("X-CSRF-Token", csrf)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, req)
			if response.Code != tc.wantStatus || int(aiCalls.Load()) != tc.wantAI {
				t.Fatalf("status=%d AI calls=%d, want %d/%d; body=%s", response.Code, aiCalls.Load(), tc.wantStatus, tc.wantAI, response.Body.String())
			}
			if tc.wantAI > 0 && (!response.Flushed || !strings.Contains(response.Body.String(), "[DONE]") || response.Header().Get("Cache-Control") != "private, no-store") {
				t.Fatal("summary was buffered or cached")
			}
		})
	}
}
