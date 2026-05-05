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
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/services/scheduler-worker/internal/service"
)

func TestSchedulerEnqueueDeduplicatesByDedupeKey(t *testing.T) {
	router := newTestRouter(testConfig())
	body := `{"mode":"repository","repository":"octo/repo"}`

	first := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/jobs/sync", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(first, request)
	if first.Code != http.StatusAccepted {
		t.Fatalf("first status = %d, want %d, body=%s", first.Code, http.StatusAccepted, first.Body.String())
	}

	second := httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodPost, "/v1/jobs/sync", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(second, request)
	if second.Code != http.StatusAccepted {
		t.Fatalf("second status = %d, want %d, body=%s", second.Code, http.StatusAccepted, second.Body.String())
	}

	var response contracts.SchedulerEnqueueResponse
	if err := json.Unmarshal(second.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal second response: %v", err)
	}
	if !response.Deduplicated {
		t.Fatalf("deduplicated = false, want true")
	}
	if len(response.JobIDs) != 1 {
		t.Fatalf("job ids len = %d, want 1", len(response.JobIDs))
	}
}

func TestSchedulerFailMovesJobToDeadLetterAndReplayRequeues(t *testing.T) {
	router := newTestRouter(testConfig())

	enqueueResponse := httptest.NewRecorder()
	enqueueRequest := httptest.NewRequest(http.MethodPost, "/v1/jobs/sync", strings.NewReader(`{"mode":"repository","repository":"octo/repo"}`))
	enqueueRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(enqueueResponse, enqueueRequest)
	if enqueueResponse.Code != http.StatusAccepted {
		t.Fatalf("enqueue status = %d, want %d, body=%s", enqueueResponse.Code, http.StatusAccepted, enqueueResponse.Body.String())
	}

	var enqueueOut contracts.SchedulerEnqueueResponse
	if err := json.Unmarshal(enqueueResponse.Body.Bytes(), &enqueueOut); err != nil {
		t.Fatalf("unmarshal enqueue response: %v", err)
	}
	jobID := enqueueOut.JobIDs[0]

	for range 3 {
		failResponse := httptest.NewRecorder()
		failRequest := httptest.NewRequest(http.MethodPost, "/v1/jobs/"+jobID+"/fail", strings.NewReader(`{"error_message":"boom"}`))
		failRequest.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(failResponse, failRequest)
		if failResponse.Code != http.StatusOK {
			t.Fatalf("fail status = %d, want %d, body=%s", failResponse.Code, http.StatusOK, failResponse.Body.String())
		}
	}

	deadLettersResponse := httptest.NewRecorder()
	router.ServeHTTP(deadLettersResponse, httptest.NewRequest(http.MethodGet, "/v1/jobs/dead-letters", nil))
	if deadLettersResponse.Code != http.StatusOK {
		t.Fatalf("dead letters status = %d, want %d, body=%s", deadLettersResponse.Code, http.StatusOK, deadLettersResponse.Body.String())
	}

	var deadLetters contracts.SchedulerDeadLetterListResponse
	if err := json.Unmarshal(deadLettersResponse.Body.Bytes(), &deadLetters); err != nil {
		t.Fatalf("unmarshal dead letters: %v", err)
	}
	if len(deadLetters.Records) != 1 {
		t.Fatalf("dead letter count = %d, want 1", len(deadLetters.Records))
	}

	replayResponse := httptest.NewRecorder()
	replayRequest := httptest.NewRequest(http.MethodPost, "/v1/jobs/dead-letters/"+deadLetters.Records[0].ID+"/replay", nil)
	router.ServeHTTP(replayResponse, replayRequest)
	if replayResponse.Code != http.StatusAccepted {
		t.Fatalf("replay status = %d, want %d, body=%s", replayResponse.Code, http.StatusAccepted, replayResponse.Body.String())
	}

	var replayOut contracts.SchedulerJobActionResponse
	if err := json.Unmarshal(replayResponse.Body.Bytes(), &replayOut); err != nil {
		t.Fatalf("unmarshal replay response: %v", err)
	}
	if replayOut.Status != "replayed" {
		t.Fatalf("replay status = %q, want %q", replayOut.Status, "replayed")
	}
	if replayOut.Job.ID == jobID {
		t.Fatalf("replayed job id = %q, want new job id", replayOut.Job.ID)
	}
}

func TestSchedulerPauseResumeAndMetrics(t *testing.T) {
	router := newTestRouter(testConfig())

	enqueueResponse := httptest.NewRecorder()
	enqueueRequest := httptest.NewRequest(http.MethodPost, "/v1/jobs/sync", strings.NewReader(`{"mode":"user","user":"octocat"}`))
	enqueueRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(enqueueResponse, enqueueRequest)
	if enqueueResponse.Code != http.StatusAccepted {
		t.Fatalf("enqueue status = %d, want %d, body=%s", enqueueResponse.Code, http.StatusAccepted, enqueueResponse.Body.String())
	}

	var enqueueOut contracts.SchedulerEnqueueResponse
	if err := json.Unmarshal(enqueueResponse.Body.Bytes(), &enqueueOut); err != nil {
		t.Fatalf("unmarshal enqueue response: %v", err)
	}
	jobID := enqueueOut.JobIDs[0]

	pauseResponse := httptest.NewRecorder()
	router.ServeHTTP(pauseResponse, httptest.NewRequest(http.MethodPost, "/v1/jobs/"+jobID+"/pause", nil))
	if pauseResponse.Code != http.StatusOK {
		t.Fatalf("pause status = %d, want %d, body=%s", pauseResponse.Code, http.StatusOK, pauseResponse.Body.String())
	}

	resumeResponse := httptest.NewRecorder()
	router.ServeHTTP(resumeResponse, httptest.NewRequest(http.MethodPost, "/v1/jobs/"+jobID+"/resume", nil))
	if resumeResponse.Code != http.StatusOK {
		t.Fatalf("resume status = %d, want %d, body=%s", resumeResponse.Code, http.StatusOK, resumeResponse.Body.String())
	}

	metricsResponse := httptest.NewRecorder()
	router.ServeHTTP(metricsResponse, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if metricsResponse.Code != http.StatusOK {
		t.Fatalf("metrics status = %d, want %d", metricsResponse.Code, http.StatusOK)
	}

	body := metricsResponse.Body.String()
	for _, fragment := range []string{
		`gitrank_scheduler_queue_depth{service="scheduler-worker",queue="github-sync"} 1`,
		`gitrank_scheduler_job_retries_total{service="scheduler-worker",queue="github-sync"} 0`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("metrics body missing %q: %s", fragment, body)
		}
	}
}

func TestSchedulerQueueStatusFiltersByUserAndRepository(t *testing.T) {
	router := newTestRouter(testConfig())

	for _, body := range []string{
		`{"mode":"user","user":"octocat"}`,
		`{"mode":"repository","repository":"octo/repo"}`,
	} {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/v1/jobs/sync", strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, request)
		if response.Code != http.StatusAccepted {
			t.Fatalf("enqueue status = %d, want %d, body=%s", response.Code, http.StatusAccepted, response.Body.String())
		}
	}

	userResponse := httptest.NewRecorder()
	router.ServeHTTP(userResponse, httptest.NewRequest(http.MethodGet, "/v1/jobs?user=octocat", nil))
	if userResponse.Code != http.StatusOK {
		t.Fatalf("user filter status = %d, want %d, body=%s", userResponse.Code, http.StatusOK, userResponse.Body.String())
	}
	var userOut contracts.SchedulerQueueStatusResponse
	if err := json.Unmarshal(userResponse.Body.Bytes(), &userOut); err != nil {
		t.Fatalf("unmarshal user filter response: %v", err)
	}
	if userOut.VisibleJobs != 1 || len(userOut.Jobs) != 1 {
		t.Fatalf("user filtered jobs = %+v, want exactly one job", userOut)
	}

	repoResponse := httptest.NewRecorder()
	router.ServeHTTP(repoResponse, httptest.NewRequest(http.MethodGet, "/v1/jobs?repository=octo/repo", nil))
	if repoResponse.Code != http.StatusOK {
		t.Fatalf("repository filter status = %d, want %d, body=%s", repoResponse.Code, http.StatusOK, repoResponse.Body.String())
	}
	var repoOut contracts.SchedulerQueueStatusResponse
	if err := json.Unmarshal(repoResponse.Body.Bytes(), &repoOut); err != nil {
		t.Fatalf("unmarshal repository filter response: %v", err)
	}
	if repoOut.VisibleJobs != 1 || len(repoOut.Jobs) != 1 || repoOut.Jobs[0].Repository != "octo/repo" {
		t.Fatalf("repository filtered jobs = %+v, want one octo/repo job", repoOut)
	}
}

func TestSchedulerBackfillPlanCreateAndList(t *testing.T) {
	router := newTestRouter(testConfig())

	createResponse := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/v1/jobs/backfills", strings.NewReader(`{
		"name":"daily-user-backfill",
		"cron":"0 */6 * * *",
		"targets":[{"mode":"user","user":"octocat"}]
	}`))
	createRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(createResponse, createRequest)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create status = %d, want %d, body=%s", createResponse.Code, http.StatusCreated, createResponse.Body.String())
	}

	var created contracts.SchedulerBackfillPlanView
	if err := json.Unmarshal(createResponse.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal create response: %v", err)
	}
	if created.ID == "" {
		t.Fatal("created plan id is empty")
	}
	if created.TargetCount != 1 {
		t.Fatalf("target count = %d, want 1", created.TargetCount)
	}

	listResponse := httptest.NewRecorder()
	router.ServeHTTP(listResponse, httptest.NewRequest(http.MethodGet, "/v1/jobs/backfills", nil))
	if listResponse.Code != http.StatusOK {
		t.Fatalf("list status = %d, want %d, body=%s", listResponse.Code, http.StatusOK, listResponse.Body.String())
	}

	var listed contracts.SchedulerBackfillPlanListResponse
	if err := json.Unmarshal(listResponse.Body.Bytes(), &listed); err != nil {
		t.Fatalf("unmarshal list response: %v", err)
	}
	if len(listed.Plans) != 1 {
		t.Fatalf("list count = %d, want 1", len(listed.Plans))
	}
	if listed.Plans[0].ID != created.ID {
		t.Fatalf("listed plan id = %q, want %q", listed.Plans[0].ID, created.ID)
	}
}

func TestSchedulerBackfillPlanPauseResumeAndDelete(t *testing.T) {
	router := newTestRouter(testConfig())

	createResponse := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/v1/jobs/backfills", strings.NewReader(`{
		"name":"maintainer-history",
		"cron":"0 */6 * * *",
		"targets":[{"mode":"repository","repository":"octo/repo"}]
	}`))
	createRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(createResponse, createRequest)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create status = %d, want %d, body=%s", createResponse.Code, http.StatusCreated, createResponse.Body.String())
	}

	var created contracts.SchedulerBackfillPlanView
	if err := json.Unmarshal(createResponse.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal create response: %v", err)
	}

	pauseResponse := httptest.NewRecorder()
	router.ServeHTTP(pauseResponse, httptest.NewRequest(http.MethodPost, "/v1/jobs/backfills/"+created.ID+"/pause", nil))
	if pauseResponse.Code != http.StatusOK {
		t.Fatalf("pause status = %d, want %d, body=%s", pauseResponse.Code, http.StatusOK, pauseResponse.Body.String())
	}
	var paused contracts.SchedulerBackfillPlanActionResponse
	if err := json.Unmarshal(pauseResponse.Body.Bytes(), &paused); err != nil {
		t.Fatalf("unmarshal pause response: %v", err)
	}
	if paused.Status != "paused" || paused.Plan.Enabled {
		t.Fatalf("pause response = %+v, want disabled paused plan", paused)
	}

	resumeResponse := httptest.NewRecorder()
	router.ServeHTTP(resumeResponse, httptest.NewRequest(http.MethodPost, "/v1/jobs/backfills/"+created.ID+"/resume", nil))
	if resumeResponse.Code != http.StatusOK {
		t.Fatalf("resume status = %d, want %d, body=%s", resumeResponse.Code, http.StatusOK, resumeResponse.Body.String())
	}
	var resumed contracts.SchedulerBackfillPlanActionResponse
	if err := json.Unmarshal(resumeResponse.Body.Bytes(), &resumed); err != nil {
		t.Fatalf("unmarshal resume response: %v", err)
	}
	if resumed.Status != "resumed" || !resumed.Plan.Enabled {
		t.Fatalf("resume response = %+v, want enabled resumed plan", resumed)
	}
	if resumed.Plan.NextRunAt.IsZero() {
		t.Fatal("resumed plan next_run_at is zero")
	}

	deleteResponse := httptest.NewRecorder()
	router.ServeHTTP(deleteResponse, httptest.NewRequest(http.MethodDelete, "/v1/jobs/backfills/"+created.ID, nil))
	if deleteResponse.Code != http.StatusOK {
		t.Fatalf("delete status = %d, want %d, body=%s", deleteResponse.Code, http.StatusOK, deleteResponse.Body.String())
	}

	listResponse := httptest.NewRecorder()
	router.ServeHTTP(listResponse, httptest.NewRequest(http.MethodGet, "/v1/jobs/backfills", nil))
	if listResponse.Code != http.StatusOK {
		t.Fatalf("list status = %d, want %d, body=%s", listResponse.Code, http.StatusOK, listResponse.Body.String())
	}
	var listed contracts.SchedulerBackfillPlanListResponse
	if err := json.Unmarshal(listResponse.Body.Bytes(), &listed); err != nil {
		t.Fatalf("unmarshal list response: %v", err)
	}
	if len(listed.Plans) != 0 {
		t.Fatalf("list count = %d, want 0", len(listed.Plans))
	}
}

func TestSchedulerBackfillPlanTicksAndQueuesTargets(t *testing.T) {
	cfg := testConfig()
	cfg.Scheduler.SyncCron = "*/5 * * * *"
	scheduler := service.New(cfg)
	_, err := scheduler.CreateBackfillPlan(contracts.SchedulerBackfillPlanRequest{
		Name: "user-history",
		Cron: "*/5 * * * *",
		Targets: []contracts.SyncRequest{
			{Mode: "user", User: "octocat"},
			{Mode: "repository", Repository: "octo/repo"},
		},
	}, time.Now().Add(-10*time.Minute))
	if err != nil {
		t.Fatalf("CreateBackfillPlan() error = %v", err)
	}
	router := NewRouter(cfg, scheduler, testLogger(), "test")

	tickResponse := httptest.NewRecorder()
	router.ServeHTTP(tickResponse, httptest.NewRequest(http.MethodPost, "/v1/jobs/tick", nil))
	if tickResponse.Code != http.StatusOK {
		t.Fatalf("tick status = %d, want %d, body=%s", tickResponse.Code, http.StatusOK, tickResponse.Body.String())
	}

	var tickOut contracts.SchedulerTickResponse
	if err := json.Unmarshal(tickResponse.Body.Bytes(), &tickOut); err != nil {
		t.Fatalf("unmarshal tick response: %v", err)
	}
	if tickOut.DuePlans != 1 {
		t.Fatalf("due plans = %d, want 1", tickOut.DuePlans)
	}
	if tickOut.QueuedJobs != 2 {
		t.Fatalf("queued jobs = %d, want 2", tickOut.QueuedJobs)
	}

	queueResponse := httptest.NewRecorder()
	router.ServeHTTP(queueResponse, httptest.NewRequest(http.MethodGet, "/v1/jobs", nil))
	if queueResponse.Code != http.StatusOK {
		t.Fatalf("queue status = %d, want %d, body=%s", queueResponse.Code, http.StatusOK, queueResponse.Body.String())
	}
}

func TestSchedulerRateLimitsPerUserSyncs(t *testing.T) {
	cfg := testConfig()
	cfg.Scheduler.PerUserRateWindow = time.Hour
	cfg.Scheduler.PerUserRateMax = 1
	router := newTestRouter(cfg)

	first := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/jobs/sync", strings.NewReader(`{"mode":"user","user":"octocat"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(first, request)
	if first.Code != http.StatusAccepted {
		t.Fatalf("first status = %d, want %d, body=%s", first.Code, http.StatusAccepted, first.Body.String())
	}

	second := httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodPost, "/v1/jobs/sync", strings.NewReader(`{"mode":"user","user":"octocat"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(second, request)
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("second status = %d, want %d, body=%s", second.Code, http.StatusTooManyRequests, second.Body.String())
	}
	if second.Header().Get("Retry-After") == "" {
		t.Fatal("Retry-After header missing")
	}
}

func testConfig() config.App {
	return config.App{
		ServiceName: "scheduler-worker",
		Env:         config.Development,
		Addr:        ":8086",
		Log: config.Log{
			Level:  "info",
			Format: "text",
		},
		ShutdownTimeout: time.Second,
		Scheduler: config.Scheduler{
			SyncCron:                  "0 */6 * * *",
			MaxAttempts:               3,
			RetryBackoff:              time.Millisecond,
			WorkerConcurrency:         2,
			LeaseTTL:                  time.Second,
			PollInterval:              time.Second,
			DeadLetterQueue:           "github-sync-dead-letter",
			PerUserRateWindow:         time.Minute,
			PerUserRateMax:            6,
			PerInstallationRateWindow: time.Minute,
			PerInstallationRateMax:    10,
		},
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func newTestRouter(cfg config.App) http.Handler {
	return NewRouter(cfg, service.New(cfg), testLogger(), "test")
}
