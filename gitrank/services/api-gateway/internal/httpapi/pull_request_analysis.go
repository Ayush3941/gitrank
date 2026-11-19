package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gitrank/gitrank/packages/authkit"
	"github.com/gitrank/gitrank/packages/contracts"
)

func handlePullRequestSyncExecution(w http.ResponseWriter, r *http.Request, client *http.Client, ingestorBaseURL, analyzerBaseURL, scoringBaseURL, profileBaseURL string) {
	handleModeSyncExecution(w, r, client, ingestorBaseURL, "pull_request", "/v1/sync/pull-request/execute", func(ctx context.Context, principal authkit.Principal, req contracts.SyncRequest, execution *contracts.GitHubSyncExecutionResponse) error {
		status := strings.ToLower(strings.TrimSpace(execution.Status))
		if status != "completed" && status != "partial" {
			return nil
		}
		if execution.Fetched == nil {
			execution.Fetched = map[string]int{}
		}
		payload, err := postInternalJSON(ctx, client, analyzerBaseURL, "/v1/analyze/pull-request/execute", contracts.SyncRequest{
			Repository: req.Repository,
			Number:     req.Number,
		}, http.StatusOK)
		if err != nil {
			execution.Fetched["post_sync_analysis_failed"] = 1
			return fmt.Errorf("PR analysis failed: %w", err)
		}
		var analysis contracts.PullRequestAnalysisResponse
		if err := json.Unmarshal(payload, &analysis); err != nil {
			execution.Fetched["post_sync_analysis_failed"] = 1
			return fmt.Errorf("invalid PR analysis response: %w", err)
		}
		if err := analysis.Validate(); err != nil || strings.TrimSpace(analysis.AnalysisID) == "" || strings.TrimSpace(analysis.PullRequestID) == "" {
			execution.Fetched["post_sync_analysis_failed"] = 1
			return fmt.Errorf("analyzer did not return a valid persisted analysis")
		}
		execution.Analysis = &analysis
		execution.Fetched["post_sync_analysis_ok"] = 1
		if err := refreshUserDashboardEvidence(ctx, client, principal.Subject, scoringBaseURL, profileBaseURL, execution); err != nil {
			return err
		}
		execution.Fetched["post_sync_refresh_ok"] = 1
		if execution.Fetched["post_sync_score_replay_mismatch"] > 0 && status == "completed" {
			execution.Status = "partial"
		}
		return nil
	})
}
