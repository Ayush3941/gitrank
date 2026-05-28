package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/authkit"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/httpkit"
)

func handleSyncRequest(w http.ResponseWriter, r *http.Request, client *http.Client, ingestorBaseURL string, analytics *analyticsMetricsSource) {
	var req contracts.SyncRequest
	if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	principal, _ := authkit.PrincipalFromContext(r.Context())
	if err := normalizeSyncRequest(&req, principal); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	targetPath, err := syncRoute(req.Mode)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	headers := defaultForwardHeaders(r)
	headers["Content-Type"] = "application/json"
	headers["X-GitRank-Subject"] = principal.Subject
	headers["X-GitRank-GitHub-Login"] = principal.GitHubLogin

	body, _ := json.Marshal(req)
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))

	proxyRequest(w, r, client, ingestorBaseURL, targetPath, proxyOptions{
		ForwardHeaders: headers,
		ResponseHeaders: map[string]string{
			"Cache-Control": "private, no-store",
		},
		Transform: func(response *http.Response, payload []byte) (int, []byte, map[string]string, error) {
			if response.StatusCode >= http.StatusBadRequest {
				analytics.Observe("sync.failed", "api-gateway", req.Mode, "failure")
			}
			if response.StatusCode != http.StatusAccepted {
				return response.StatusCode, payload, nil, nil
			}
			analytics.Observe("sync.succeeded", "api-gateway", req.Mode, "success")
			var preview contracts.GitHubQueuePreview
			if err := json.Unmarshal(payload, &preview); err != nil {
				return 0, nil, nil, err
			}
			if err := validateQueuePreview(preview); err != nil {
				return 0, nil, nil, fmt.Errorf("invalid github-ingestor queue preview contract: %w", err)
			}

			out := contracts.SyncResponse{
				Status:        preview.Status,
				CorrelationID: preview.CorrelationID,
				AcceptedAt:    preview.AcceptedAt,
			}
			if len(preview.JobIDs) > 0 {
				out.JobID = preview.JobIDs[0]
			}
			encoded, err := json.Marshal(out)
			if err != nil {
				return 0, nil, nil, err
			}
			return http.StatusAccepted, encoded, map[string]string{
				"Cache-Control": "private, no-store",
			}, nil
		},
	})
}

func handleSyncRunList(w http.ResponseWriter, r *http.Request, client *http.Client, ingestorBaseURL string) {
	principal, _ := authkit.PrincipalFromContext(r.Context())
	query := r.URL.Query()
	if strings.TrimSpace(query.Get("requested_by_subject")) == "" {
		query.Set("requested_by_subject", strings.TrimSpace(principal.Subject))
	}
	if strings.TrimSpace(query.Get("requested_by_github_login")) == "" {
		query.Set("requested_by_github_login", strings.TrimSpace(principal.GitHubLogin))
	}
	if strings.EqualFold(strings.TrimSpace(query.Get("run_type")), "user") &&
		strings.TrimSpace(query.Get("user")) == "" &&
		strings.TrimSpace(principal.GitHubLogin) != "" {
		query.Set("user", strings.TrimSpace(principal.GitHubLogin))
	}
	if strings.TrimSpace(query.Get("limit")) == "" {
		query.Set("limit", "25")
	}

	request := r.Clone(r.Context())
	request.URL.RawQuery = query.Encode()
	proxyRequest(w, request, client, ingestorBaseURL, "/v1/sync/runs", proxyOptions{
		ForwardHeaders: defaultForwardHeaders(r),
		ResponseHeaders: map[string]string{
			"Cache-Control": "private, no-store",
		},
	})
}

func handleRepositorySyncExecution(w http.ResponseWriter, r *http.Request, client *http.Client, ingestorBaseURL string) {
	handleModeSyncExecution(w, r, client, ingestorBaseURL, "repository", "/v1/sync/repository/execute", nil)
}

func handleUserSyncExecution(w http.ResponseWriter, r *http.Request, client *http.Client, ingestorBaseURL, scoringBaseURL, profileBaseURL string) {
	handleModeSyncExecution(w, r, client, ingestorBaseURL, "user", "/v1/sync/user/execute", func(ctx context.Context, principal authkit.Principal, execution *contracts.GitHubSyncExecutionResponse) error {
		if err := refreshUserDashboardEvidence(ctx, client, principal.Subject, scoringBaseURL, profileBaseURL, execution); err != nil {
			if execution.Fetched == nil {
				execution.Fetched = map[string]int{}
			}
			execution.Fetched["post_sync_refresh_failed"] = 1
			return err
		}
		if execution.Fetched == nil {
			execution.Fetched = map[string]int{}
		}
		execution.Fetched["post_sync_refresh_ok"] = 1
		if (execution.Fetched["post_sync_score_replay_mismatch"] > 0 || execution.Fetched["post_sync_score_replay_expected_zero_unmerged"] > 0) &&
			strings.EqualFold(strings.TrimSpace(execution.Status), "completed") {
			execution.Status = "partial"
		}
		return nil
	})
}

func handleInstallationSyncExecution(w http.ResponseWriter, r *http.Request, client *http.Client, ingestorBaseURL string) {
	handleModeSyncExecution(w, r, client, ingestorBaseURL, "installation", "/v1/sync/installation/execute", nil)
}

type syncExecutionPostProcessor func(context.Context, authkit.Principal, *contracts.GitHubSyncExecutionResponse) error

func handleModeSyncExecution(
	w http.ResponseWriter,
	r *http.Request,
	client *http.Client,
	ingestorBaseURL string,
	mode string,
	targetPath string,
	postProcessor syncExecutionPostProcessor,
) {
	var req contracts.SyncRequest
	if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	principal, _ := authkit.PrincipalFromContext(r.Context())
	req.Mode = mode
	req.User = strings.TrimSpace(req.User)
	req.Repository = strings.TrimSpace(req.Repository)
	req.SHA = strings.TrimSpace(req.SHA)
	if req.Mode == "user" && req.User == "" {
		req.User = strings.TrimSpace(principal.GitHubLogin)
	}
	if err := req.Normalize(); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	headers := defaultForwardHeaders(r)
	headers["Content-Type"] = "application/json"
	headers["X-GitRank-Subject"] = principal.Subject
	headers["X-GitRank-GitHub-Login"] = principal.GitHubLogin

	body, _ := json.Marshal(req)
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))

	proxyRequest(w, r, client, ingestorBaseURL, targetPath, proxyOptions{
		ForwardHeaders: headers,
		ResponseHeaders: map[string]string{
			"Cache-Control": "private, no-store",
		},
		Transform: func(response *http.Response, payload []byte) (int, []byte, map[string]string, error) {
			if response.StatusCode != http.StatusOK {
				return response.StatusCode, payload, nil, nil
			}
			var execution contracts.GitHubSyncExecutionResponse
			if err := json.Unmarshal(payload, &execution); err != nil {
				return 0, nil, nil, err
			}
			if strings.TrimSpace(execution.Status) == "" || execution.StartedAt.IsZero() || execution.FinishedAt.IsZero() {
				return 0, nil, nil, fmt.Errorf("invalid github-ingestor execution contract")
			}
			if postProcessor != nil {
				if err := postProcessor(r.Context(), principal, &execution); err != nil {
					if execution.Fetched == nil {
						execution.Fetched = map[string]int{}
					}
					execution.Fetched["post_sync_refresh_failed"] = 1
					execution.Status = "partial"
				}
			}
			encoded, err := json.Marshal(execution)
			if err != nil {
				return 0, nil, nil, err
			}
			return http.StatusOK, encoded, map[string]string{
				"Cache-Control": "private, no-store",
			}, nil
		},
	})
}

func normalizeSyncRequest(req *contracts.SyncRequest, principal authkit.Principal) error {
	req.Mode = strings.ToLower(strings.TrimSpace(req.Mode))
	req.User = strings.TrimSpace(req.User)
	req.Repository = strings.TrimSpace(req.Repository)
	req.SHA = strings.TrimSpace(req.SHA)

	if req.Mode == "" {
		req.Mode = "user"
	}
	if req.Mode == "user" && req.User == "" {
		req.User = strings.TrimSpace(principal.GitHubLogin)
	}

	return req.Normalize()
}

func validateQueuePreview(preview contracts.GitHubQueuePreview) error {
	if strings.TrimSpace(preview.Status) == "" {
		return errors.New("missing status")
	}
	if preview.AcceptedAt.IsZero() {
		return errors.New("missing accepted_at")
	}
	return nil
}

func syncRoute(mode string) (string, error) {
	switch mode {
	case "installation":
		return "/v1/sync/installation", nil
	case "user":
		return "/v1/sync/user", nil
	case "repository":
		return "/v1/sync/repository", nil
	case "pull_request":
		return "/v1/sync/pull-request", nil
	case "review":
		return "/v1/sync/review", nil
	case "issue":
		return "/v1/sync/issue", nil
	case "commit":
		return "/v1/sync/commit", nil
	default:
		return "", errors.New("unsupported sync mode")
	}
}

func validateSessionCSRF(r *http.Request, sessionCookieName string, sessionSecrets [][]byte) error {
	sessionCookie, err := r.Cookie(strings.TrimSpace(sessionCookieName))
	if err != nil || strings.TrimSpace(sessionCookie.Value) == "" {
		return errors.New("missing session cookie")
	}

	provided := strings.TrimSpace(r.Header.Get("X-CSRF-Token"))
	if err := authkit.ValidateDoubleSubmitCSRF(sessionSecrets, sessionCookie.Value, provided); err != nil {
		return errors.New("invalid CSRF token")
	}
	return nil
}

func allowRateLimit(w http.ResponseWriter, r *http.Request, limiter *rateLimiter, scope string) bool {
	retryAfter, allowed := limiter.Allow(scope+":"+clientIP(r), time.Now().UTC())
	if allowed {
		return true
	}
	w.Header().Set("Retry-After", retryAfterSeconds(retryAfter))
	httpkit.WriteError(w, http.StatusTooManyRequests, "rate_limited", "too many requests", httpkit.RequestIDFromContext(r.Context()))
	return false
}

func refreshUserDashboardEvidence(
	ctx context.Context,
	client *http.Client,
	subject, scoringBaseURL, profileBaseURL string,
	execution *contracts.GitHubSyncExecutionResponse,
) error {
	userID, err := contracts.NormalizeUUID(subject, "subject")
	if err != nil {
		return fmt.Errorf("invalid authenticated subject: %w", err)
	}

	if execution != nil && execution.Fetched == nil {
		execution.Fetched = map[string]int{}
	}

	var postSyncErrors []error
	scoreReplayPayload, err := postInternalJSON(
		ctx,
		client,
		scoringBaseURL,
		"/v1/score/users/"+userID+"/replay",
		contracts.ReplayUserScoresRequest{TriggerType: "live"},
		http.StatusAccepted,
	)
	if err != nil {
		if execution != nil {
			execution.Fetched["post_sync_score_replay_failed"] = 1
		}
		postSyncErrors = append(postSyncErrors, fmt.Errorf("score replay failed: %w", err))
	} else if execution != nil {
		execution.Fetched["post_sync_score_replay_ok"] = 1
		var replay contracts.ReplayUserScoresResponse
		if len(scoreReplayPayload) > 0 && json.Unmarshal(scoreReplayPayload, &replay) == nil {
			execution.Fetched["post_sync_score_replay_events"] = max(0, replay.Events)
			execution.Fetched["post_sync_score_replay_total_xp"] = max(0, replay.Snapshot.TotalXP)
			execution.Fetched["post_sync_score_replay_badges"] = len(replay.Badges)
			if replay.Events == 0 {
				execution.Fetched["post_sync_score_replay_empty"] = 1
				selectedTargets := max(0, execution.Fetched["authored_pull_requests_selected"])
				selectedMergedTargets := max(0, execution.Fetched["authored_pull_requests_selected_merged"])
				selectedUnmergedTargets := max(0, execution.Fetched["authored_pull_requests_selected_unmerged"])
				if selectedTargets > 0 && selectedMergedTargets > 0 {
					execution.Fetched["post_sync_score_replay_mismatch"] = 1
				} else if selectedTargets > 0 && selectedUnmergedTargets == selectedTargets {
					execution.Fetched["post_sync_score_replay_expected_zero_unmerged"] = 1
				}
			}
		}
	}

	type profileStep struct {
		name       string
		metricKey  string
		path       string
		expectCode int
	}
	for _, step := range []profileStep{
		{name: "profile refresh", metricKey: "profile_refresh", path: "/v1/profile/users/" + userID + "/refresh", expectCode: http.StatusAccepted},
		{name: "pr report backfill", metricKey: "pr_reports_backfill", path: "/v1/profile/users/" + userID + "/pr-reports/backfill", expectCode: http.StatusAccepted},
		{name: "quest backfill", metricKey: "quests_backfill", path: "/v1/profile/users/" + userID + "/quests/backfill", expectCode: http.StatusAccepted},
	} {
		if _, err := postInternalJSON(ctx, client, profileBaseURL, step.path, nil, step.expectCode); err != nil {
			if execution != nil {
				execution.Fetched["post_sync_"+step.metricKey+"_failed"] = 1
			}
			postSyncErrors = append(postSyncErrors, fmt.Errorf("%s failed: %w", step.name, err))
			continue
		}
		if execution != nil {
			execution.Fetched["post_sync_"+step.metricKey+"_ok"] = 1
		}
	}
	return errors.Join(postSyncErrors...)
}

func postInternalJSON(
	ctx context.Context,
	client *http.Client,
	baseURL, path string,
	requestBody any,
	expectedStatus int,
) ([]byte, error) {
	if strings.TrimSpace(baseURL) == "" {
		return nil, errors.New("missing upstream base URL")
	}
	target, err := buildProxyURL(baseURL, path, "")
	if err != nil {
		return nil, err
	}

	var body io.Reader
	if requestBody != nil {
		encoded, err := json.Marshal(requestBody)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(encoded)
	}

	callCtx, cancel := context.WithTimeout(ctx, internalPostTimeout(path))
	defer cancel()

	request, err := http.NewRequestWithContext(callCtx, http.MethodPost, target, body)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	httpkit.InjectTraceContext(callCtx, request.Header)

	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode == expectedStatus {
		payload, readErr := io.ReadAll(io.LimitReader(response.Body, 128<<10))
		if readErr != nil {
			return nil, readErr
		}
		return payload, nil
	}

	payload, _ := io.ReadAll(io.LimitReader(response.Body, 8<<10))
	var contractError contracts.ErrorResponse
	if err := json.Unmarshal(payload, &contractError); err == nil {
		message := strings.TrimSpace(contractError.Error.Message)
		if message != "" {
			return nil, fmt.Errorf("status %d: %s", response.StatusCode, message)
		}
	}
	trimmedPayload := strings.TrimSpace(string(payload))
	if trimmedPayload == "" {
		return nil, fmt.Errorf("status %d", response.StatusCode)
	}
	return nil, fmt.Errorf("status %d: %s", response.StatusCode, trimmedPayload)
}

func internalPostTimeout(path string) time.Duration {
	switch {
	case strings.Contains(path, "/pr-reports/backfill"):
		return 2 * time.Minute
	case strings.Contains(path, "/profile/users/") && strings.Contains(path, "/refresh"):
		return 60 * time.Second
	case strings.Contains(path, "/quests/backfill"):
		return 60 * time.Second
	default:
		return 30 * time.Second
	}
}
