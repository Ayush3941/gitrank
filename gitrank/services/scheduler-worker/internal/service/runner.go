package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/packages/store"
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

type httpBoundedSyncExecutor struct {
	baseURL string
	client  *http.Client
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

	finishedAt := time.Now().UTC()
	execution, err := s.executeLeasedJob(ctx, job)
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
	response.Execution = &execution
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

func (s *Service) executeLeasedJob(ctx context.Context, job store.QueueJob) (contracts.GitHubSyncExecutionResponse, error) {
	if s.repositoryRunner == nil {
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("bounded sync runner is not configured")
	}

	switch job.Type {
	case store.SyncInstallationJob:
		req, err := syncRequestFromJob(job)
		if err != nil {
			return contracts.GitHubSyncExecutionResponse{}, err
		}
		return s.repositoryRunner.SyncInstallation(ctx, req, correlationIDForJob(job))
	case store.SyncRepositoryJob:
		req, err := syncRequestFromJob(job)
		if err != nil {
			return contracts.GitHubSyncExecutionResponse{}, err
		}
		return s.repositoryRunner.SyncRepository(ctx, req, correlationIDForJob(job))
	case store.SyncUserHistoryJob:
		req, err := syncRequestFromJob(job)
		if err != nil {
			return contracts.GitHubSyncExecutionResponse{}, err
		}
		return s.repositoryRunner.SyncUser(ctx, req, correlationIDForJob(job))
	case store.SyncPullRequestJob:
		req, err := syncRequestFromJob(job)
		if err != nil {
			return contracts.GitHubSyncExecutionResponse{}, err
		}
		return s.repositoryRunner.SyncPullRequest(ctx, req, correlationIDForJob(job))
	case store.SyncReviewJob:
		req, err := syncRequestFromJob(job)
		if err != nil {
			return contracts.GitHubSyncExecutionResponse{}, err
		}
		return s.repositoryRunner.SyncReview(ctx, req, correlationIDForJob(job))
	case store.SyncIssueJob:
		req, err := syncRequestFromJob(job)
		if err != nil {
			return contracts.GitHubSyncExecutionResponse{}, err
		}
		return s.repositoryRunner.SyncIssue(ctx, req, correlationIDForJob(job))
	case store.SyncCommitJob:
		req, err := syncRequestFromJob(job)
		if err != nil {
			return contracts.GitHubSyncExecutionResponse{}, err
		}
		return s.repositoryRunner.SyncCommit(ctx, req, correlationIDForJob(job))
	default:
		return contracts.GitHubSyncExecutionResponse{}, fmt.Errorf("job type %s is not executable by the in-process worker", job.Type)
	}
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
	return (job.Type == store.SyncInstallationJob || job.Type == store.SyncRepositoryJob || job.Type == store.SyncUserHistoryJob || job.Type == store.SyncPullRequestJob || job.Type == store.SyncReviewJob || job.Type == store.SyncIssueJob || job.Type == store.SyncCommitJob) &&
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
