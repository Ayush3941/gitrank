package store

import (
	"errors"
	"strconv"

	"github.com/Ayush3941/gitrank/packages/contracts"
)

func BuildSyncJobs(req contracts.SyncRequest, queueName, correlationID string, maxAttempts int) ([]QueueJob, error) {
	if err := req.Normalize(); err != nil {
		return nil, err
	}

	switch req.Mode {
	case "installation":
		if req.InstallationID <= 0 {
			return nil, errors.New("installation_id is required when mode=installation")
		}
		job, err := NewQueueJob(QueueJobInput{
			QueueName:      queueName,
			Type:           SyncInstallationJob,
			CorrelationID:  correlationID,
			InstallationID: req.InstallationID,
			Subject:        strconv.FormatInt(req.InstallationID, 10),
			DedupeKey:      "installation:" + strconv.FormatInt(req.InstallationID, 10),
			MaxAttempts:    maxAttempts,
			Payload: map[string]any{
				"installation_id": req.InstallationID,
				"mode":            "installation",
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
	case "user":
		if req.User == "" {
			return nil, errors.New("user is required when mode=user")
		}
		job, err := NewQueueJob(QueueJobInput{
			QueueName:     queueName,
			Type:          SyncUserHistoryJob,
			CorrelationID: correlationID,
			Subject:       req.User,
			DedupeKey:     "user:" + req.User,
			MaxAttempts:   maxAttempts,
			Payload: map[string]string{
				"user": req.User,
				"mode": "user",
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
	case "repository":
		if req.Repository == "" {
			return nil, errors.New("repository is required when mode=repository")
		}
		job, err := NewQueueJob(QueueJobInput{
			QueueName:     queueName,
			Type:          SyncRepositoryJob,
			CorrelationID: correlationID,
			Repository:    req.Repository,
			DedupeKey:     "repository:" + req.Repository,
			MaxAttempts:   maxAttempts,
			Payload: map[string]string{
				"repository": req.Repository,
				"mode":       "repository",
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
	case "pull_request":
		if req.Repository == "" || req.Number <= 0 {
			return nil, errors.New("repository and number are required when mode=pull_request")
		}
		return resourceJobs(queueName, correlationID, SyncPullRequestJob, req.Repository, req.Number, "", "pull_request", maxAttempts)
	case "review":
		if req.Repository == "" || req.Number <= 0 {
			return nil, errors.New("repository and number are required when mode=review")
		}
		return resourceJobs(queueName, correlationID, SyncReviewJob, req.Repository, req.Number, "", "review", maxAttempts)
	case "issue":
		if req.Repository == "" || req.Number <= 0 {
			return nil, errors.New("repository and number are required when mode=issue")
		}
		return resourceJobs(queueName, correlationID, SyncIssueJob, req.Repository, req.Number, "", "issue", maxAttempts)
	case "commit":
		if req.Repository == "" || req.SHA == "" {
			return nil, errors.New("repository and sha are required when mode=commit")
		}
		return resourceJobs(queueName, correlationID, SyncCommitJob, req.Repository, 0, req.SHA, "commit", maxAttempts)
	default:
		return nil, errors.New("unsupported sync mode")
	}
}

func resourceJobs(
	queueName string,
	correlationID string,
	jobType SyncJobType,
	repository string,
	number int,
	sha string,
	mode string,
	maxAttempts int,
) ([]QueueJob, error) {
	subject := repository
	payload := map[string]any{
		"repository": repository,
		"mode":       mode,
	}
	dedupeKey := mode + ":" + repository
	if number > 0 {
		subject = repository + "#" + strconv.Itoa(number)
		payload["number"] = number
		dedupeKey = subject
	}
	if sha != "" {
		subject = repository + "@" + sha
		payload["sha"] = sha
		dedupeKey = subject
	}

	job, err := NewQueueJob(QueueJobInput{
		QueueName:     queueName,
		Type:          jobType,
		CorrelationID: correlationID,
		Repository:    repository,
		Subject:       subject,
		DedupeKey:     dedupeKey,
		MaxAttempts:   maxAttempts,
		Payload:       payload,
	})
	if err != nil {
		return nil, err
	}
	return []QueueJob{job}, nil
}
