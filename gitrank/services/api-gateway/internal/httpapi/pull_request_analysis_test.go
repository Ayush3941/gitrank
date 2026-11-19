package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/authkit"
	"github.com/gitrank/gitrank/packages/contracts"
)

func TestPullRequestSyncRunsPersistedAnalysisBeforeScoreAndReportRefresh(t *testing.T) {
	const userID = "00000000-0000-0000-0000-000000000001"
	for _, tc := range []struct {
		name              string
		syncStatus        string
		analyzerStatus    int
		analysisSource    string
		fallbackReason    string
		missingAnalysisID bool
		refreshFailure    bool
		wantStatus        string
		wantAnalysis      bool
		wantRefresh       bool
	}{
		{name: "deterministic analysis saved", syncStatus: "completed", analyzerStatus: 200, analysisSource: "deterministic", wantStatus: "completed", wantAnalysis: true, wantRefresh: true},
		{name: "partial sync", syncStatus: "partial", analyzerStatus: 200, analysisSource: "deterministic", wantStatus: "partial", wantAnalysis: true, wantRefresh: true},
		{name: "analyzer unavailable", syncStatus: "completed", analyzerStatus: 503, wantStatus: "partial"},
		{name: "analysis not persisted", syncStatus: "completed", analyzerStatus: 200, analysisSource: "deterministic", missingAnalysisID: true, wantStatus: "partial"},
		{name: "score refresh fails after analysis save", syncStatus: "completed", analyzerStatus: 200, analysisSource: "deterministic", refreshFailure: true, wantStatus: "partial", wantAnalysis: true, wantRefresh: true},
		{name: "sync failed", syncStatus: "failed", wantStatus: "failed"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var mu sync.Mutex
			var calls []string
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				mu.Lock()
				calls = append(calls, r.URL.Path)
				mu.Unlock()
				if r.Method != http.MethodPost {
					t.Errorf("method = %s, want POST", r.Method)
				}
				switch r.URL.Path {
				case "/v1/sync/pull-request/execute":
					if r.Header.Get("X-GitRank-Subject") != userID {
						t.Error("sync must forward authenticated subject")
					}
					_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
						Status: tc.syncStatus, Mode: "pull_request", Repository: "octo/repo", Number: 17,
						StartedAt: time.Now().UTC(), FinishedAt: time.Now().UTC(),
						Fetched: map[string]int{}, Persisted: map[string]int{"pull_requests": 1},
					})
				case "/v1/analyze/pull-request/execute":
					var req contracts.SyncRequest
					if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Repository != "octo/repo" || req.Number != 17 {
						t.Errorf("analyzer request = %+v, err = %v", req, err)
					}
					if r.Header.Get("X-Request-ID") != "retry-analysis-17" {
						t.Error("analysis must retain the retry request ID")
					}
					if tc.analyzerStatus != http.StatusOK {
						w.WriteHeader(tc.analyzerStatus)
						return
					}
					analysis := contracts.PullRequestAnalysisResponse{
						AnalysisID: "analysis-17", PullRequestID: "pr-17",
						AnalyzerVersion: "deterministic.v1", AnalysisSource: tc.analysisSource,
						ValidationStatus: contracts.AnalysisValidationValidated,
						Category:         "feature", Summary: "Adds request validation.", TechnicalDepth: 1, ReviewStrength: 1,
						FallbackReason: tc.fallbackReason,
					}
					if tc.analysisSource == "hybrid" {
						analysis.PromptVersion = "ai.summary.v1"
						analysis.ModelName = "gpt-4o-mini"
					}
					if tc.missingAnalysisID {
						analysis.AnalysisID = ""
					}
					_ = json.NewEncoder(w).Encode(analysis)
				case "/v1/score/users/" + userID + "/replay":
					if tc.refreshFailure {
						w.WriteHeader(http.StatusServiceUnavailable)
						return
					}
					w.WriteHeader(http.StatusAccepted)
					_ = json.NewEncoder(w).Encode(contracts.ReplayUserScoresResponse{Events: 1})
				case "/v1/profile/users/" + userID + "/refresh":
					w.WriteHeader(http.StatusAccepted)
					_ = json.NewEncoder(w).Encode(contracts.ProfileRefreshResponse{
						Status: contracts.ProfileRefreshStatusCompleted, SnapshotPersisted: true, ScoreEventCount: 1,
					})
				case "/v1/profile/users/" + userID + "/quests/backfill", "/v1/profile/users/" + userID + "/pr-reports/backfill":
					w.WriteHeader(http.StatusAccepted)
					_, _ = w.Write([]byte(`{"status":"backfilled"}`))
				default:
					t.Errorf("unexpected pipeline route %s", r.URL.Path)
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			defer upstream.Close()
			auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_ = json.NewEncoder(w).Encode(contracts.SessionEnvelope{Session: contracts.SessionIdentity{
					Subject: userID, GitHubLogin: "octocat", Roles: []string{"user"},
				}})
			}))
			defer auth.Close()
			cfg := testConfig(upstream.URL, auth.URL, upstream.URL)
			cfg.Services.PRAnalyzerBaseURL = upstream.URL
			cfg.Services.ScoringBaseURL = upstream.URL
			router := NewRouter(cfg, testLogger(), "test")
			request := httptest.NewRequest(http.MethodPost, "/v1/sync/pull-request/execute", strings.NewReader(`{"repository":" octo/repo ","number":17}`))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Cookie", "gitrank_session=session-original")
			request.Header.Set("X-Request-ID", "retry-analysis-17")
			csrf, err := authkit.DoubleSubmitCSRFFromToken([]byte(cfg.Auth.SessionSecret), "session-original")
			if err != nil {
				t.Fatal(err)
			}
			request.Header.Set("X-CSRF-Token", csrf)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("status = %d, body=%s", response.Code, response.Body.String())
			}
			var execution contracts.GitHubSyncExecutionResponse
			if err := json.Unmarshal(response.Body.Bytes(), &execution); err != nil {
				t.Fatal(err)
			}
			if execution.Status != tc.wantStatus || (execution.Analysis != nil) != tc.wantAnalysis {
				t.Fatalf("execution = %+v, want status %s, analysis=%t", execution, tc.wantStatus, tc.wantAnalysis)
			}
			if tc.wantAnalysis && (execution.Analysis.AnalysisSource != tc.analysisSource || execution.Analysis.FallbackReason != tc.fallbackReason) {
				t.Fatalf("analysis provenance lost: %+v", execution.Analysis)
			}
			if tc.syncStatus != "failed" && !tc.wantAnalysis && execution.Fetched["post_sync_analysis_failed"] != 1 {
				t.Fatal("analysis failure was not recorded")
			}
			wantCalls := []string{"/v1/sync/pull-request/execute"}
			if tc.syncStatus != "failed" {
				wantCalls = append(wantCalls, "/v1/analyze/pull-request/execute")
			}
			if tc.wantRefresh {
				wantCalls = append(wantCalls, "/v1/score/users/"+userID+"/replay", "/v1/profile/users/"+userID+"/refresh", "/v1/profile/users/"+userID+"/quests/backfill", "/v1/profile/users/"+userID+"/pr-reports/backfill")
			}
			mu.Lock()
			defer mu.Unlock()
			if !reflect.DeepEqual(calls, wantCalls) {
				t.Fatalf("pipeline calls = %v, want %v", calls, wantCalls)
			}
		})
	}
}
