package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/gitrank/gitrank/packages/store"
)

type boundedSyncExecutor interface {
	SyncInstallation(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error)
	SyncRepository(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error)
	SyncUser(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error)
	SyncPullRequest(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error)
	SyncReview(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error)
	SyncIssue(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error)
	SyncCommit(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error)
}

type scoreReplayExecutor interface {
	ReplayUser(ctx context.Context, userID string, correlationID string) (contracts.SchedulerScoreReplayExecutionResponse, error)
}

type profileRefreshExecutor interface {
	RefreshProfile(ctx context.Context, userID string, correlationID string) (contracts.SchedulerProfileRefreshResponse, error)
}

type pullRequestReportExecutor interface {
	LoadPullRequestReport(ctx context.Context, repository string, number int, correlationID string) (contracts.SchedulerPullRequestReportResponse, error)
	MaterializePullRequestReport(ctx context.Context, repository string, number int, correlationID string) (contracts.SchedulerPullRequestReportMaterializationResponse, error)
}

type leaderboardExecutor interface {
	MaterializeLeaderboard(ctx context.Context, correlationID string) (contracts.SchedulerLeaderboardMaterializationResponse, error)
}

type pullRequestAnalysisExecutor interface {
	AnalyzePullRequest(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.SchedulerPullRequestAnalysisResponse, error)
}

type httpBoundedSyncExecutor struct {
	baseURL string
	client  *http.Client
}

type httpPullRequestAnalysisExecutor struct {
	baseURL string
	client  *http.Client
}

type httpScoreReplayExecutor struct {
	baseURL string
	client  *http.Client
}

type httpProfileRefreshExecutor struct {
	baseURL string
	client  *http.Client
}

type httpPullRequestReportExecutor struct {
	baseURL string
	client  *http.Client
}

type httpLeaderboardExecutor struct {
	baseURL string
	client  *http.Client
}

type jobExecution struct {
	Sync                       *contracts.GitHubSyncExecutionResponse
	Analysis                   *contracts.SchedulerPullRequestAnalysisResponse
	ScoreReplay                *contracts.SchedulerScoreReplayExecutionResponse
	ProfileRefresh             *contracts.SchedulerProfileRefreshResponse
	ReportMaterialization      *contracts.SchedulerPullRequestReportMaterializationResponse
	LeaderboardMaterialization *contracts.SchedulerLeaderboardMaterializationResponse
	Grade                      *contracts.SchedulerPullRequestGradeResponse
}

type executionCounters struct {
	mu        sync.Mutex
	lastRunAt time.Time
	byOutcome map[string]int
}

func newBoundedSyncExecutor(cfg config.App) boundedSyncExecutor {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.Services.GitHubIngestorBaseURL), "/")
	if baseURL == "" {
		return nil
	}
	return &httpBoundedSyncExecutor{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: cfg.Services.RequestTimeout,
		},
	}
}

func newScoreReplayExecutor(cfg config.App) scoreReplayExecutor {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.Services.ScoringBaseURL), "/")
	if baseURL == "" {
		return nil
	}
	return &httpScoreReplayExecutor{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: cfg.Services.RequestTimeout,
		},
	}
}

func newPullRequestAnalysisExecutor(cfg config.App) pullRequestAnalysisExecutor {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.Services.PRAnalyzerBaseURL), "/")
	if baseURL == "" {
		return nil
	}
	return &httpPullRequestAnalysisExecutor{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: cfg.Services.RequestTimeout,
		},
	}
}

func newProfileRefreshExecutor(cfg config.App) profileRefreshExecutor {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.Services.ProfileBaseURL), "/")
	if baseURL == "" {
		return nil
	}
	return &httpProfileRefreshExecutor{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: cfg.Services.RequestTimeout,
		},
	}
}

func newPullRequestReportExecutor(cfg config.App) pullRequestReportExecutor {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.Services.ProfileBaseURL), "/")
	if baseURL == "" {
		return nil
	}
	return &httpPullRequestReportExecutor{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: cfg.Services.RequestTimeout,
		},
	}
}

func newLeaderboardExecutor(cfg config.App) leaderboardExecutor {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.Services.ProfileBaseURL), "/")
	if baseURL == "" {
		return nil
	}
	return &httpLeaderboardExecutor{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: cfg.Services.RequestTimeout,
		},
	}
}

func newExecutionCounters() *executionCounters {
	return &executionCounters{
		byOutcome: make(map[string]int),
	}
}

func (s *Service) RunNext(ctx context.Context, now time.Time) (contracts.SchedulerRunResponse, error) {
	now = now.UTC()
	response := contracts.SchedulerRunResponse{
		QueueName:     primaryQueueName,
		Status:        "idle",
		LastUpdatedAt: now,
	}

	job, ok, err := s.leaseNextExecutableJob(now)
	if err != nil || !ok {
		return response, err
	}

	execution, err := s.executeLeasedJob(ctx, job)
	finishedAt := time.Now().UTC()
	if err != nil {
		action, actionErr := s.Fail(job.ID, err.Error(), finishedAt)
		if actionErr != nil {
			return response, actionErr
		}
		response.Status = action.Status
		response.LastUpdatedAt = action.LastUpdatedAt
		response.Job = schedulerJobPointer(action.Job)
		s.recordExecution(job.Type, action.Status, finishedAt)
		return response, nil
	}

	action, err := s.Complete(job.ID, finishedAt)
	if err != nil {
		return response, err
	}
	response.Status = action.Status
	response.LastUpdatedAt = action.LastUpdatedAt
	response.Job = schedulerJobPointer(action.Job)
	response.Execution = execution.Sync
	response.Analysis = execution.Analysis
	response.ScoreReplay = execution.ScoreReplay
	response.ProfileRefresh = execution.ProfileRefresh
	response.ReportMaterialization = execution.ReportMaterialization
	response.LeaderboardMaterialization = execution.LeaderboardMaterialization
	response.Grade = execution.Grade
	s.recordExecution(job.Type, action.Status, finishedAt)
	return response, nil
}

func (s *Service) leaseNextExecutableJob(now time.Time) (store.QueueJob, bool, error) {
	if s.stateStore != nil {
		var (
			job store.QueueJob
			ok  bool
		)
		err := s.withDurableMutation(context.Background(), now, func() error {
			var innerErr error
			job, ok, innerErr = s.leaseNextExecutableJobLocal(now)
			return innerErr
		})
		return job, ok, err
	}
	return s.leaseNextExecutableJobLocal(now)
}

func (s *Service) leaseNextExecutableJobLocal(now time.Time) (store.QueueJob, bool, error) {
	jobs := s.queue.Jobs()
	for _, job := range jobs {
		if !isExecutableJob(job, now) {
			continue
		}
		leased, err := s.queue.LeaseJob(job.ID, now, s.cfg.Scheduler.WorkerConcurrency, s.cfg.Scheduler.LeaseTTL)
		if err == nil {
			return leased, true, nil
		}
		switch {
		case strings.Contains(err.Error(), "worker concurrency reached"):
			return store.QueueJob{}, false, nil
		case strings.Contains(err.Error(), "job is not ready"), strings.Contains(err.Error(), "job not found"):
			continue
		default:
			return store.QueueJob{}, false, err
		}
	}
	return store.QueueJob{}, false, nil
}

func (s *Service) executeLeasedJob(ctx context.Context, job store.QueueJob) (jobExecution, error) {
	switch job.Type {
	case store.SyncInstallationJob:
		if s.repositoryRunner == nil {
			return jobExecution{}, fmt.Errorf("bounded sync runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		return syncJobExecution(s.repositoryRunner.SyncInstallation(ctx, req, correlationIDForJob(job)))
	case store.SyncRepositoryJob:
		if s.repositoryRunner == nil {
			return jobExecution{}, fmt.Errorf("bounded sync runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		return syncJobExecution(s.repositoryRunner.SyncRepository(ctx, req, correlationIDForJob(job)))
	case store.SyncUserHistoryJob:
		if s.repositoryRunner == nil {
			return jobExecution{}, fmt.Errorf("bounded sync runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		return syncJobExecution(s.repositoryRunner.SyncUser(ctx, req, correlationIDForJob(job)))
	case store.SyncPullRequestJob:
		if s.repositoryRunner == nil {
			return jobExecution{}, fmt.Errorf("bounded sync runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		return syncJobExecution(s.repositoryRunner.SyncPullRequest(ctx, req, correlationIDForJob(job)))
	case store.SyncReviewJob:
		if s.repositoryRunner == nil {
			return jobExecution{}, fmt.Errorf("bounded sync runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		return syncJobExecution(s.repositoryRunner.SyncReview(ctx, req, correlationIDForJob(job)))
	case store.SyncIssueJob:
		if s.repositoryRunner == nil {
			return jobExecution{}, fmt.Errorf("bounded sync runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		return syncJobExecution(s.repositoryRunner.SyncIssue(ctx, req, correlationIDForJob(job)))
	case store.SyncCommitJob:
		if s.repositoryRunner == nil {
			return jobExecution{}, fmt.Errorf("bounded sync runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		return syncJobExecution(s.repositoryRunner.SyncCommit(ctx, req, correlationIDForJob(job)))
	case store.AnalysisPullRequestJob:
		if s.analysisRunner == nil {
			return jobExecution{}, fmt.Errorf("pull request analysis runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		execution, err := s.analysisRunner.AnalyzePullRequest(ctx, req, correlationIDForJob(job))
		if err != nil {
			return jobExecution{}, err
		}
		return jobExecution{Analysis: &execution}, nil
	case store.ScoreReplayUserJob:
		if s.scoreRunner == nil {
			return jobExecution{}, fmt.Errorf("score replay runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		execution, err := s.scoreRunner.ReplayUser(ctx, req.UserID, correlationIDForJob(job))
		if err != nil {
			return jobExecution{}, err
		}
		return jobExecution{ScoreReplay: &execution}, nil
	case store.ProfileRefreshUserJob:
		if s.profileRunner == nil {
			return jobExecution{}, fmt.Errorf("profile refresh runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		execution, err := s.profileRunner.RefreshProfile(ctx, req.UserID, correlationIDForJob(job))
		if err != nil {
			return jobExecution{}, err
		}
		return jobExecution{ProfileRefresh: &execution}, nil
	case store.ReportMaterializePRJob:
		if s.reportRunner == nil {
			return jobExecution{}, fmt.Errorf("pull request report runner is not configured")
		}
		req, err := syncRequestFromJob(job)
		if err != nil {
			return jobExecution{}, err
		}
		execution, err := s.reportRunner.MaterializePullRequestReport(ctx, req.Repository, req.Number, correlationIDForJob(job))
		if err != nil {
			return jobExecution{}, err
		}
		return jobExecution{ReportMaterialization: &execution}, nil
	case store.LeaderboardMaterializeJob:
		if s.leaderboardRunner == nil {
			return jobExecution{}, fmt.Errorf("leaderboard runner is not configured")
		}
		execution, err := s.leaderboardRunner.MaterializeLeaderboard(ctx, correlationIDForJob(job))
		if err != nil {
			return jobExecution{}, err
		}
		return jobExecution{LeaderboardMaterialization: &execution}, nil
	case store.GradePullRequestJob:
		return s.executePullRequestGradeJob(ctx, job)
	default:
		return jobExecution{}, fmt.Errorf("job type %s is not executable by the in-process worker", job.Type)
	}
}

func (s *Service) executePullRequestGradeJob(ctx context.Context, job store.QueueJob) (jobExecution, error) {
	if s.repositoryRunner == nil {
		return jobExecution{}, fmt.Errorf("bounded sync runner is not configured")
	}
	if s.analysisRunner == nil {
		return jobExecution{}, fmt.Errorf("pull request analysis runner is not configured")
	}
	if s.scoreRunner == nil {
		return jobExecution{}, fmt.Errorf("score replay runner is not configured")
	}
	if s.profileRunner == nil {
		return jobExecution{}, fmt.Errorf("profile refresh runner is not configured")
	}
	if s.reportRunner == nil {
		return jobExecution{}, fmt.Errorf("pull request report runner is not configured")
	}

	req, err := syncRequestFromJob(job)
	if err != nil {
		return jobExecution{}, err
	}

	correlationID := correlationIDForJob(job)
	startedAt := time.Now().UTC()
	syncExecution, err := s.repositoryRunner.SyncPullRequest(ctx, req, correlationID)
	if err != nil {
		return jobExecution{}, err
	}
	analysisExecution, err := s.analysisRunner.AnalyzePullRequest(ctx, req, correlationID)
	if err != nil {
		return jobExecution{}, err
	}
	scoreExecution, err := s.scoreRunner.ReplayUser(ctx, req.UserID, correlationID)
	if err != nil {
		return jobExecution{}, err
	}
	profileExecution, err := s.profileRunner.RefreshProfile(ctx, req.UserID, correlationID)
	if err != nil {
		return jobExecution{}, err
	}
	reportMaterialization, err := s.reportRunner.MaterializePullRequestReport(ctx, req.Repository, req.Number, correlationID)
	if err != nil {
		return jobExecution{}, err
	}
	reportExecution, err := s.reportRunner.LoadPullRequestReport(ctx, req.Repository, req.Number, correlationID)
	if err != nil {
		return jobExecution{}, err
	}

	return jobExecution{Grade: &contracts.SchedulerPullRequestGradeResponse{
		Status:                "completed",
		Repository:            req.Repository,
		Number:                req.Number,
		UserID:                req.UserID,
		Sync:                  &syncExecution,
		Analysis:              &analysisExecution,
		ScoreReplay:           &scoreExecution,
		ProfileRefresh:        &profileExecution,
		ReportMaterialization: &reportMaterialization,
		Report:                &reportExecution,
		CorrelationID:         strings.TrimSpace(correlationID),
		StartedAt:             startedAt,
		FinishedAt:            time.Now().UTC(),
	}}, nil
}

func syncJobExecution(execution contracts.GitHubSyncExecutionResponse, err error) (jobExecution, error) {
	if err != nil {
		return jobExecution{}, err
	}
	return jobExecution{Sync: &execution}, nil
}

func (e *httpBoundedSyncExecutor) SyncRepository(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error) {
	req.Mode = "repository"
	req.Repository = strings.TrimSpace(req.Repository)
	if req.Repository == "" {
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("repository is required")
	}
	return e.execute(ctx, req, "/v1/sync/repository/execute", "repository", correlationID)
}

func (e *httpBoundedSyncExecutor) SyncInstallation(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error) {
	req.Mode = "installation"
	if req.InstallationID <= 0 {
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("installation_id is required")
	}
	return e.execute(ctx, req, "/v1/sync/installation/execute", "installation", correlationID)
}

func (e *httpBoundedSyncExecutor) SyncUser(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error) {
	req.Mode = "user"
	req.User = strings.TrimSpace(req.User)
	if req.User == "" {
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("user is required")
	}
	return e.execute(ctx, req, "/v1/sync/user/execute", "user", correlationID)
}

func (e *httpBoundedSyncExecutor) SyncPullRequest(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error) {
	req.Mode = "pull_request"
	req.Repository = strings.TrimSpace(req.Repository)
	if req.Repository == "" || req.Number <= 0 {
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("repository and number are required")
	}
	return e.execute(ctx, req, "/v1/sync/pull-request/execute", "pull_request", correlationID)
}

func (e *httpBoundedSyncExecutor) SyncReview(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error) {
	req.Mode = "review"
	req.Repository = strings.TrimSpace(req.Repository)
	if req.Repository == "" || req.Number <= 0 {
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("repository and number are required")
	}
	return e.execute(ctx, req, "/v1/sync/review/execute", "review", correlationID)
}

func (e *httpBoundedSyncExecutor) SyncIssue(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error) {
	req.Mode = "issue"
	req.Repository = strings.TrimSpace(req.Repository)
	if req.Repository == "" || req.Number <= 0 {
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("repository and number are required")
	}
	return e.execute(ctx, req, "/v1/sync/issue/execute", "issue", correlationID)
}

func (e *httpBoundedSyncExecutor) SyncCommit(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.GitHubSyncExecutionResponse, error) {
	req.Mode = "commit"
	req.Repository = strings.TrimSpace(req.Repository)
	req.SHA = strings.TrimSpace(req.SHA)
	if req.Repository == "" || req.SHA == "" {
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("repository and sha are required")
	}
	return e.execute(ctx, req, "/v1/sync/commit/execute", "commit", correlationID)
}

func (e *httpBoundedSyncExecutor) execute(ctx context.Context, req contracts.SyncRequest, path, mode, correlationID string) (contracts.GitHubSyncExecutionResponse, error) {
	ctx = httpkit.EnsureTraceContext(ctx)
	body, err := json.Marshal(req)
	if err != nil {
		return contracts.GitHubSyncExecutionResponse{}, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, e.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return contracts.GitHubSyncExecutionResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(correlationID) != "" {
		request.Header.Set("X-Request-ID", strings.TrimSpace(correlationID))
	}
	httpkit.InjectTraceContext(ctx, request.Header)

	response, err := e.client.Do(request)
	if err != nil {
		return contracts.GitHubSyncExecutionResponse{}, err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return contracts.GitHubSyncExecutionResponse{}, err
	}
	if response.StatusCode != http.StatusOK {
		var apiErr contracts.ErrorResponse
		if err := json.Unmarshal(payload, &apiErr); err == nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("github-ingestor %s sync failed: %s", mode, apiErr.Error.Message)
		}
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("github-ingestor %s sync failed with status %d", mode, response.StatusCode)
	}

	var execution contracts.GitHubSyncExecutionResponse
	if err := json.Unmarshal(payload, &execution); err != nil {
		return contracts.GitHubSyncExecutionResponse{}, err
	}
	if strings.TrimSpace(execution.Status) == "" || execution.StartedAt.IsZero() || execution.FinishedAt.IsZero() {
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("github-ingestor returned an invalid %s sync contract", mode)
	}
	return execution, nil
}

func (e *httpPullRequestAnalysisExecutor) AnalyzePullRequest(ctx context.Context, req contracts.SyncRequest, correlationID string) (contracts.SchedulerPullRequestAnalysisResponse, error) {
	req.Mode = "analysis_pull_request"
	if err := req.Normalize(); err != nil {
		return contracts.SchedulerPullRequestAnalysisResponse{}, err
	}

	ctx = httpkit.EnsureTraceContext(ctx)
	body, err := json.Marshal(req)
	if err != nil {
		return contracts.SchedulerPullRequestAnalysisResponse{}, err
	}

	startedAt := time.Now().UTC()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, e.baseURL+"/v1/analyze/pull-request/execute", bytes.NewReader(body))
	if err != nil {
		return contracts.SchedulerPullRequestAnalysisResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(correlationID) != "" {
		request.Header.Set("X-Request-ID", strings.TrimSpace(correlationID))
	}
	httpkit.InjectTraceContext(ctx, request.Header)

	response, err := e.client.Do(request)
	if err != nil {
		return contracts.SchedulerPullRequestAnalysisResponse{}, err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return contracts.SchedulerPullRequestAnalysisResponse{}, err
	}
	if response.StatusCode != http.StatusOK {
		var apiErr contracts.ErrorResponse
		if err := json.Unmarshal(payload, &apiErr); err == nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return contracts.SchedulerPullRequestAnalysisResponse{}, fmt.Errorf("pr-analyzer pull request analysis failed: %s", apiErr.Error.Message)
		}
		return contracts.SchedulerPullRequestAnalysisResponse{}, fmt.Errorf("pr-analyzer pull request analysis failed with status %d", response.StatusCode)
	}

	var analysis contracts.PullRequestAnalysisResponse
	if err := json.Unmarshal(payload, &analysis); err != nil {
		return contracts.SchedulerPullRequestAnalysisResponse{}, err
	}
	if strings.TrimSpace(analysis.AnalysisID) == "" ||
		strings.TrimSpace(analysis.PullRequestID) == "" ||
		strings.TrimSpace(analysis.AnalyzerVersion) == "" ||
		strings.TrimSpace(analysis.AnalysisSource) == "" ||
		strings.TrimSpace(analysis.Category) == "" {
		return contracts.SchedulerPullRequestAnalysisResponse{}, fmt.Errorf("pr-analyzer returned an invalid persisted analysis contract")
	}

	return contracts.SchedulerPullRequestAnalysisResponse{
		Status:          "completed",
		Repository:      req.Repository,
		Number:          req.Number,
		PullRequestID:   strings.TrimSpace(analysis.PullRequestID),
		AnalysisID:      strings.TrimSpace(analysis.AnalysisID),
		AnalyzerVersion: strings.TrimSpace(analysis.AnalyzerVersion),
		AnalysisSource:  strings.TrimSpace(analysis.AnalysisSource),
		Category:        strings.TrimSpace(analysis.Category),
		CorrelationID:   strings.TrimSpace(correlationID),
		StartedAt:       startedAt,
		FinishedAt:      time.Now().UTC(),
	}, nil
}

func (e *httpScoreReplayExecutor) ReplayUser(ctx context.Context, userID string, correlationID string) (contracts.SchedulerScoreReplayExecutionResponse, error) {
	userID, err := contracts.NormalizeUUID(userID, "user_id")
	if err != nil {
		return contracts.SchedulerScoreReplayExecutionResponse{}, err
	}

	ctx = httpkit.EnsureTraceContext(ctx)
	replayRequest := contracts.ReplayUserScoresRequest{TriggerType: "backfill"}
	body, err := json.Marshal(replayRequest)
	if err != nil {
		return contracts.SchedulerScoreReplayExecutionResponse{}, err
	}

	startedAt := time.Now().UTC()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, e.baseURL+"/v1/score/users/"+url.PathEscape(userID)+"/replay", bytes.NewReader(body))
	if err != nil {
		return contracts.SchedulerScoreReplayExecutionResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(correlationID) != "" {
		request.Header.Set("X-Request-ID", strings.TrimSpace(correlationID))
	}
	httpkit.InjectTraceContext(ctx, request.Header)

	response, err := e.client.Do(request)
	if err != nil {
		return contracts.SchedulerScoreReplayExecutionResponse{}, err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return contracts.SchedulerScoreReplayExecutionResponse{}, err
	}
	if response.StatusCode != http.StatusAccepted && response.StatusCode != http.StatusOK {
		var apiErr contracts.ErrorResponse
		if err := json.Unmarshal(payload, &apiErr); err == nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return contracts.SchedulerScoreReplayExecutionResponse{}, fmt.Errorf("scoring-engine replay failed: %s", apiErr.Error.Message)
		}
		return contracts.SchedulerScoreReplayExecutionResponse{}, fmt.Errorf("scoring-engine replay failed with status %d", response.StatusCode)
	}

	var replay contracts.ReplayUserScoresResponse
	if err := json.Unmarshal(payload, &replay); err != nil {
		return contracts.SchedulerScoreReplayExecutionResponse{}, err
	}
	if strings.TrimSpace(replay.Snapshot.UserID) == "" ||
		strings.TrimSpace(replay.Snapshot.ReplayRunID) == "" ||
		strings.TrimSpace(replay.Snapshot.ScoreVersion) == "" ||
		strings.TrimSpace(replay.Snapshot.TriggerType) == "" {
		return contracts.SchedulerScoreReplayExecutionResponse{}, fmt.Errorf("scoring-engine returned an invalid score replay contract")
	}
	if replay.Snapshot.UserID != userID {
		return contracts.SchedulerScoreReplayExecutionResponse{}, fmt.Errorf("scoring-engine replay user_id mismatch")
	}
	if strings.TrimSpace(replay.Snapshot.TriggerType) != replayRequest.TriggerType {
		return contracts.SchedulerScoreReplayExecutionResponse{}, fmt.Errorf("scoring-engine replay trigger_type mismatch")
	}

	return contracts.SchedulerScoreReplayExecutionResponse{
		Status:        "completed",
		UserID:        replay.Snapshot.UserID,
		ReplayRunID:   replay.Snapshot.ReplayRunID,
		ScoreVersion:  replay.Snapshot.ScoreVersion,
		TriggerType:   replay.Snapshot.TriggerType,
		TotalXP:       replay.Snapshot.TotalXP,
		EventCount:    replay.Events,
		BadgeCount:    len(replay.Badges),
		CorrelationID: strings.TrimSpace(correlationID),
		StartedAt:     startedAt,
		FinishedAt:    time.Now().UTC(),
	}, nil
}

func (e *httpProfileRefreshExecutor) RefreshProfile(ctx context.Context, userID string, correlationID string) (contracts.SchedulerProfileRefreshResponse, error) {
	userID, err := contracts.NormalizeUUID(userID, "user_id")
	if err != nil {
		return contracts.SchedulerProfileRefreshResponse{}, err
	}

	ctx = httpkit.EnsureTraceContext(ctx)
	startedAt := time.Now().UTC()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, e.baseURL+"/v1/profile/users/"+url.PathEscape(userID)+"/refresh", nil)
	if err != nil {
		return contracts.SchedulerProfileRefreshResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	if strings.TrimSpace(correlationID) != "" {
		request.Header.Set("X-Request-ID", strings.TrimSpace(correlationID))
	}
	httpkit.InjectTraceContext(ctx, request.Header)

	response, err := e.client.Do(request)
	if err != nil {
		return contracts.SchedulerProfileRefreshResponse{}, err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return contracts.SchedulerProfileRefreshResponse{}, err
	}
	if response.StatusCode != http.StatusAccepted && response.StatusCode != http.StatusOK {
		var apiErr contracts.ErrorResponse
		if err := json.Unmarshal(payload, &apiErr); err == nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return contracts.SchedulerProfileRefreshResponse{}, fmt.Errorf("profile-service refresh failed: %s", apiErr.Error.Message)
		}
		return contracts.SchedulerProfileRefreshResponse{}, fmt.Errorf("profile-service refresh failed with status %d", response.StatusCode)
	}

	var refresh contracts.ProfileRefreshResponse
	if err := json.Unmarshal(payload, &refresh); err != nil {
		return contracts.SchedulerProfileRefreshResponse{}, err
	}
	if strings.TrimSpace(refresh.UserID) == "" ||
		strings.TrimSpace(refresh.ProfileSnapshotID) == "" ||
		strings.TrimSpace(refresh.ProfileSnapshotVersion) == "" ||
		strings.TrimSpace(refresh.Status) == "" ||
		refresh.RefreshedAt.IsZero() ||
		refresh.StaleAfter.IsZero() {
		return contracts.SchedulerProfileRefreshResponse{}, fmt.Errorf("profile-service returned an invalid refresh contract")
	}
	if refresh.UserID != userID {
		return contracts.SchedulerProfileRefreshResponse{}, fmt.Errorf("profile-service refresh user_id mismatch")
	}

	return contracts.SchedulerProfileRefreshResponse{
		Status:                 refresh.Status,
		UserID:                 refresh.UserID,
		ProfileSnapshotID:      strings.TrimSpace(refresh.ProfileSnapshotID),
		ProfileSnapshotVersion: strings.TrimSpace(refresh.ProfileSnapshotVersion),
		ScoreVersion:           strings.TrimSpace(refresh.ScoreVersion),
		TotalXP:                refresh.TotalXP,
		LevelLabel:             strings.TrimSpace(refresh.LevelLabel),
		SourceWatermark:        refresh.SourceWatermark.UTC(),
		RefreshedAt:            refresh.RefreshedAt.UTC(),
		StaleAfter:             refresh.StaleAfter.UTC(),
		CorrelationID:          strings.TrimSpace(correlationID),
		StartedAt:              startedAt,
		FinishedAt:             time.Now().UTC(),
	}, nil
}

func (e *httpPullRequestReportExecutor) LoadPullRequestReport(ctx context.Context, repository string, number int, correlationID string) (contracts.SchedulerPullRequestReportResponse, error) {
	repository, err := contracts.NormalizeGitHubRepository(repository)
	if err != nil {
		return contracts.SchedulerPullRequestReportResponse{}, err
	}
	if number <= 0 {
		return contracts.SchedulerPullRequestReportResponse{}, fmt.Errorf("pull request number is required")
	}
	owner, repo, _ := strings.Cut(repository, "/")

	ctx = httpkit.EnsureTraceContext(ctx)
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		e.baseURL+"/v1/pr/"+url.PathEscape(owner)+"/"+url.PathEscape(repo)+"/"+strconv.Itoa(number)+"/report",
		nil,
	)
	if err != nil {
		return contracts.SchedulerPullRequestReportResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	if strings.TrimSpace(correlationID) != "" {
		request.Header.Set("X-Request-ID", strings.TrimSpace(correlationID))
	}
	httpkit.InjectTraceContext(ctx, request.Header)

	response, err := e.client.Do(request)
	if err != nil {
		return contracts.SchedulerPullRequestReportResponse{}, err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return contracts.SchedulerPullRequestReportResponse{}, err
	}
	if response.StatusCode != http.StatusOK {
		var apiErr contracts.ErrorResponse
		if err := json.Unmarshal(payload, &apiErr); err == nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return contracts.SchedulerPullRequestReportResponse{}, fmt.Errorf("profile-service PR report failed: %s", apiErr.Error.Message)
		}
		return contracts.SchedulerPullRequestReportResponse{}, fmt.Errorf("profile-service PR report failed with status %d", response.StatusCode)
	}

	var report contracts.PullRequestReportResponse
	if err := json.Unmarshal(payload, &report); err != nil {
		return contracts.SchedulerPullRequestReportResponse{}, err
	}
	if report.Contribution.Owner == "" ||
		report.Contribution.Repo == "" ||
		report.Contribution.Number <= 0 ||
		report.GeneratedAt.IsZero() {
		return contracts.SchedulerPullRequestReportResponse{}, fmt.Errorf("profile-service returned an invalid PR report contract")
	}
	if !strings.EqualFold(report.Contribution.Owner+"/"+report.Contribution.Repo, repository) || report.Contribution.Number != number {
		return contracts.SchedulerPullRequestReportResponse{}, fmt.Errorf("profile-service PR report target mismatch")
	}

	return contracts.SchedulerPullRequestReportResponse{
		Status:          "completed",
		Repository:      repository,
		Number:          number,
		ContributionID:  strings.TrimSpace(report.Contribution.ID),
		EvidenceStatus:  strings.TrimSpace(report.EvidenceState.Status),
		ScoreVersion:    strings.TrimSpace(report.ScoreVersion),
		AnalysisVersion: strings.TrimSpace(report.AnalysisVersion),
		IsStale:         report.IsStale,
		GeneratedAt:     report.GeneratedAt.UTC(),
	}, nil
}

func (e *httpPullRequestReportExecutor) MaterializePullRequestReport(ctx context.Context, repository string, number int, correlationID string) (contracts.SchedulerPullRequestReportMaterializationResponse, error) {
	repository, err := contracts.NormalizeGitHubRepository(repository)
	if err != nil {
		return contracts.SchedulerPullRequestReportMaterializationResponse{}, err
	}
	if number <= 0 {
		return contracts.SchedulerPullRequestReportMaterializationResponse{}, fmt.Errorf("pull request number is required")
	}
	owner, repo, _ := strings.Cut(repository, "/")

	ctx = httpkit.EnsureTraceContext(ctx)
	startedAt := time.Now().UTC()
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		e.baseURL+"/v1/pr/"+url.PathEscape(owner)+"/"+url.PathEscape(repo)+"/"+strconv.Itoa(number)+"/report/materialize",
		nil,
	)
	if err != nil {
		return contracts.SchedulerPullRequestReportMaterializationResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	if strings.TrimSpace(correlationID) != "" {
		request.Header.Set("X-Request-ID", strings.TrimSpace(correlationID))
	}
	httpkit.InjectTraceContext(ctx, request.Header)

	response, err := e.client.Do(request)
	if err != nil {
		return contracts.SchedulerPullRequestReportMaterializationResponse{}, err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return contracts.SchedulerPullRequestReportMaterializationResponse{}, err
	}
	if response.StatusCode != http.StatusAccepted && response.StatusCode != http.StatusOK {
		var apiErr contracts.ErrorResponse
		if err := json.Unmarshal(payload, &apiErr); err == nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return contracts.SchedulerPullRequestReportMaterializationResponse{}, fmt.Errorf("profile-service PR report materialization failed: %s", apiErr.Error.Message)
		}
		return contracts.SchedulerPullRequestReportMaterializationResponse{}, fmt.Errorf("profile-service PR report materialization failed with status %d", response.StatusCode)
	}

	var materialized contracts.PullRequestReportMaterializationResponse
	if err := json.Unmarshal(payload, &materialized); err != nil {
		return contracts.SchedulerPullRequestReportMaterializationResponse{}, err
	}
	if strings.TrimSpace(materialized.PullRequestID) == "" ||
		strings.TrimSpace(materialized.ReportSnapshotID) == "" ||
		strings.TrimSpace(materialized.ReportVersion) == "" ||
		strings.TrimSpace(materialized.Status) == "" ||
		materialized.Number <= 0 ||
		materialized.GeneratedAt.IsZero() {
		return contracts.SchedulerPullRequestReportMaterializationResponse{}, fmt.Errorf("profile-service returned an invalid PR report materialization contract")
	}
	if !strings.EqualFold(materialized.Repository, repository) || materialized.Number != number {
		return contracts.SchedulerPullRequestReportMaterializationResponse{}, fmt.Errorf("profile-service PR report materialization target mismatch")
	}

	return contracts.SchedulerPullRequestReportMaterializationResponse{
		Status:           strings.TrimSpace(materialized.Status),
		Repository:       repository,
		Number:           number,
		PullRequestID:    strings.TrimSpace(materialized.PullRequestID),
		ReportSnapshotID: strings.TrimSpace(materialized.ReportSnapshotID),
		ReportVersion:    strings.TrimSpace(materialized.ReportVersion),
		ScoreEventID:     strings.TrimSpace(materialized.ScoreEventID),
		AnalysisID:       strings.TrimSpace(materialized.AnalysisID),
		ScoreVersion:     strings.TrimSpace(materialized.ScoreVersion),
		AnalysisVersion:  strings.TrimSpace(materialized.AnalysisVersion),
		EvidenceStatus:   strings.TrimSpace(materialized.EvidenceStatus),
		IsStale:          materialized.IsStale,
		GeneratedAt:      materialized.GeneratedAt.UTC(),
		CorrelationID:    strings.TrimSpace(correlationID),
		StartedAt:        startedAt,
		FinishedAt:       time.Now().UTC(),
	}, nil
}

func (e *httpLeaderboardExecutor) MaterializeLeaderboard(ctx context.Context, correlationID string) (contracts.SchedulerLeaderboardMaterializationResponse, error) {
	ctx = httpkit.EnsureTraceContext(ctx)
	startedAt := time.Now().UTC()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, e.baseURL+"/v1/leaderboard/materialize", nil)
	if err != nil {
		return contracts.SchedulerLeaderboardMaterializationResponse{}, err
	}
	request.Header.Set("Accept", "application/json")
	if strings.TrimSpace(correlationID) != "" {
		request.Header.Set("X-Request-ID", strings.TrimSpace(correlationID))
	}
	httpkit.InjectTraceContext(ctx, request.Header)

	response, err := e.client.Do(request)
	if err != nil {
		return contracts.SchedulerLeaderboardMaterializationResponse{}, err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return contracts.SchedulerLeaderboardMaterializationResponse{}, err
	}
	if response.StatusCode != http.StatusAccepted && response.StatusCode != http.StatusOK {
		var apiErr contracts.ErrorResponse
		if err := json.Unmarshal(payload, &apiErr); err == nil && strings.TrimSpace(apiErr.Error.Message) != "" {
			return contracts.SchedulerLeaderboardMaterializationResponse{}, fmt.Errorf("profile-service leaderboard materialization failed: %s", apiErr.Error.Message)
		}
		return contracts.SchedulerLeaderboardMaterializationResponse{}, fmt.Errorf("profile-service leaderboard materialization failed with status %d", response.StatusCode)
	}

	var materialized contracts.LeaderboardMaterializationResponse
	if err := json.Unmarshal(payload, &materialized); err != nil {
		return contracts.SchedulerLeaderboardMaterializationResponse{}, err
	}
	if strings.TrimSpace(materialized.Status) == "" ||
		strings.TrimSpace(materialized.SeasonKey) == "" ||
		strings.TrimSpace(materialized.SeasonSnapshotVersion) == "" ||
		materialized.GeneratedAt.IsZero() ||
		materialized.SourceWatermark.IsZero() {
		return contracts.SchedulerLeaderboardMaterializationResponse{}, fmt.Errorf("profile-service returned an invalid leaderboard materialization contract")
	}

	return contracts.SchedulerLeaderboardMaterializationResponse{
		Status:                strings.TrimSpace(materialized.Status),
		SeasonKey:             strings.TrimSpace(materialized.SeasonKey),
		SeasonSnapshotVersion: strings.TrimSpace(materialized.SeasonSnapshotVersion),
		ScoringVersion:        strings.TrimSpace(materialized.ScoringVersion),
		EntryCount:            materialized.EntryCount,
		SourceWatermark:       materialized.SourceWatermark.UTC(),
		GeneratedAt:           materialized.GeneratedAt.UTC(),
		CorrelationID:         strings.TrimSpace(correlationID),
		StartedAt:             startedAt,
		FinishedAt:            time.Now().UTC(),
	}, nil
}

func (s *Service) runWorkerLoop(ctx context.Context) {
	ticker := time.NewTicker(s.cfg.Scheduler.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			_, _ = s.RunNext(ctx, now.UTC())
		}
	}
}

func (s *Service) recordExecution(jobType store.SyncJobType, status string, now time.Time) {
	if s.runs == nil {
		return
	}
	s.runs.mu.Lock()
	defer s.runs.mu.Unlock()
	s.runs.lastRunAt = now.UTC()
	s.runs.byOutcome[executionMetricKey(jobType, status)]++
}

func executionMetricKey(jobType store.SyncJobType, status string) string {
	return string(jobType) + "|" + strings.TrimSpace(status)
}

func splitExecutionMetricKey(key string) (string, string) {
	jobType, status, found := strings.Cut(key, "|")
	if !found {
		return key, ""
	}
	return jobType, status
}

func isExecutableJob(job store.QueueJob, now time.Time) bool {
	return (job.Type == store.SyncInstallationJob || job.Type == store.SyncRepositoryJob || job.Type == store.SyncUserHistoryJob || job.Type == store.SyncPullRequestJob || job.Type == store.SyncReviewJob || job.Type == store.SyncIssueJob || job.Type == store.SyncCommitJob || job.Type == store.AnalysisPullRequestJob || job.Type == store.ScoreReplayUserJob || job.Type == store.ProfileRefreshUserJob || job.Type == store.ReportMaterializePRJob || job.Type == store.LeaderboardMaterializeJob || job.Type == store.GradePullRequestJob) &&
		job.Status == store.JobPending &&
		!job.NotBefore.After(now.UTC())
}

func syncRequestFromJob(job store.QueueJob) (contracts.SyncRequest, error) {
	var req contracts.SyncRequest
	if len(job.Payload) > 0 {
		if err := json.Unmarshal(job.Payload, &req); err != nil {
			return contracts.SyncRequest{}, fmt.Errorf("decode job payload: %w", err)
		}
	}
	switch job.Type {
	case store.SyncInstallationJob:
		if req.InstallationID <= 0 {
			req.InstallationID = job.InstallationID
		}
		req.Mode = "installation"
		if req.InstallationID <= 0 {
			return contracts.SyncRequest{}, fmt.Errorf("installation_id is required")
		}
	case store.SyncRepositoryJob:
		if strings.TrimSpace(req.Repository) == "" {
			req.Repository = strings.TrimSpace(job.Repository)
		}
		req.Mode = "repository"
		req.Repository = strings.TrimSpace(req.Repository)
		if req.Repository == "" {
			return contracts.SyncRequest{}, fmt.Errorf("repository is required")
		}
	case store.SyncUserHistoryJob:
		if strings.TrimSpace(req.User) == "" {
			req.User = strings.TrimSpace(job.Subject)
		}
		req.Mode = "user"
		req.User = strings.TrimSpace(req.User)
		if req.User == "" {
			return contracts.SyncRequest{}, fmt.Errorf("user is required")
		}
	case store.SyncPullRequestJob:
		if strings.TrimSpace(req.Repository) == "" {
			req.Repository = strings.TrimSpace(job.Repository)
		}
		req.Mode = "pull_request"
		req.Repository = strings.TrimSpace(req.Repository)
		if req.Repository == "" || req.Number <= 0 {
			return contracts.SyncRequest{}, fmt.Errorf("repository and number are required")
		}
	case store.SyncReviewJob:
		if strings.TrimSpace(req.Repository) == "" {
			req.Repository = strings.TrimSpace(job.Repository)
		}
		req.Mode = "review"
		req.Repository = strings.TrimSpace(req.Repository)
		if req.Repository == "" || req.Number <= 0 {
			return contracts.SyncRequest{}, fmt.Errorf("repository and number are required")
		}
	case store.SyncIssueJob:
		if strings.TrimSpace(req.Repository) == "" {
			req.Repository = strings.TrimSpace(job.Repository)
		}
		req.Mode = "issue"
		req.Repository = strings.TrimSpace(req.Repository)
		if req.Repository == "" || req.Number <= 0 {
			return contracts.SyncRequest{}, fmt.Errorf("repository and number are required")
		}
	case store.SyncCommitJob:
		if strings.TrimSpace(req.Repository) == "" {
			req.Repository = strings.TrimSpace(job.Repository)
		}
		if strings.TrimSpace(req.SHA) == "" {
			req.SHA = strings.TrimSpace(job.Subject)
			if repository, sha, ok := strings.Cut(req.SHA, "@"); ok && strings.EqualFold(strings.TrimSpace(repository), strings.TrimSpace(job.Repository)) {
				req.SHA = strings.TrimSpace(sha)
			}
		}
		req.Mode = "commit"
		req.Repository = strings.TrimSpace(req.Repository)
		req.SHA = strings.TrimSpace(req.SHA)
		if req.Repository == "" || req.SHA == "" {
			return contracts.SyncRequest{}, fmt.Errorf("repository and sha are required")
		}
	case store.AnalysisPullRequestJob:
		if strings.TrimSpace(req.Repository) == "" {
			req.Repository = strings.TrimSpace(job.Repository)
		}
		req.Mode = "analysis_pull_request"
		req.Repository = strings.TrimSpace(req.Repository)
		if req.Repository == "" || req.Number <= 0 {
			return contracts.SyncRequest{}, fmt.Errorf("repository and number are required")
		}
	case store.ScoreReplayUserJob:
		if strings.TrimSpace(req.UserID) == "" {
			req.UserID = strings.TrimSpace(job.Subject)
		}
		req.Mode = "score_replay"
		userID, err := contracts.NormalizeUUID(req.UserID, "user_id")
		if err != nil {
			return contracts.SyncRequest{}, err
		}
		req.UserID = userID
	case store.ProfileRefreshUserJob:
		if strings.TrimSpace(req.UserID) == "" {
			req.UserID = strings.TrimSpace(job.Subject)
		}
		req.Mode = "profile_refresh"
		userID, err := contracts.NormalizeUUID(req.UserID, "user_id")
		if err != nil {
			return contracts.SyncRequest{}, err
		}
		req.UserID = userID
	case store.ReportMaterializePRJob:
		if strings.TrimSpace(req.Repository) == "" {
			req.Repository = strings.TrimSpace(job.Repository)
		}
		req.Mode = "report_materialize_pull_request"
		if err := req.Normalize(); err != nil {
			return contracts.SyncRequest{}, err
		}
	case store.LeaderboardMaterializeJob:
		req.Mode = "leaderboard_materialize_season"
		if err := req.Normalize(); err != nil {
			return contracts.SyncRequest{}, err
		}
	case store.GradePullRequestJob:
		if strings.TrimSpace(req.Repository) == "" {
			req.Repository = strings.TrimSpace(job.Repository)
		}
		req.Mode = "grade_pull_request"
		if err := req.Normalize(); err != nil {
			return contracts.SyncRequest{}, err
		}
	default:
		return contracts.SyncRequest{}, fmt.Errorf("job type %s is not executable by the in-process worker", job.Type)
	}
	return req, nil
}

func correlationIDForJob(job store.QueueJob) string {
	if strings.TrimSpace(job.CorrelationID) != "" {
		return strings.TrimSpace(job.CorrelationID)
	}
	return job.ID
}

func schedulerJobPointer(view contracts.SchedulerJobView) *contracts.SchedulerJobView {
	copy := view
	return &copy
}
