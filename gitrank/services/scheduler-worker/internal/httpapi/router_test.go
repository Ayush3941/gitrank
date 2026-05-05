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
)

func TestSchedulerEnqueueDeduplicatesByDedupeKey(t *testing.T) {
	router := NewRouter(testConfig(), testLogger(), "test")
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
	router := NewRouter(testConfig(), testLogger(), "test")

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
	router := NewRouter(testConfig(), testLogger(), "test")

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
			SyncCron:          "0 */6 * * *",
			MaxAttempts:       3,
			RetryBackoff:      time.Millisecond,
			WorkerConcurrency: 2,
			LeaseTTL:          time.Second,
			PollInterval:      time.Second,
			DeadLetterQueue:   "github-sync-dead-letter",
		},
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
