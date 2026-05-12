package store

import (
	"errors"
	"strconv"

	"github.com/gitrank/gitrank/packages/contracts"
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
	case "analysis_pull_request":
		if req.Repository == "" || req.Number <= 0 {
			return nil, errors.New("repository and number are required when mode=analysis_pull_request")
		}
		return resourceJobs(queueName, correlationID, AnalysisPullRequestJob, req.Repository, req.Number, "", "analysis_pull_request", maxAttempts)
	case "report_materialize_pull_request":
		if req.Repository == "" || req.Number <= 0 {
			return nil, errors.New("repository and number are required when mode=report_materialize_pull_request")
		}
		return resourceJobs(queueName, correlationID, ReportMaterializePRJob, req.Repository, req.Number, "", "report_materialize_pull_request", maxAttempts)
	case "report_backfill_user_pull_requests":
		if req.UserID == "" {
			return nil, errors.New("user_id is required when mode=report_backfill_user_pull_requests")
		}
		job, err := NewQueueJob(QueueJobInput{
			QueueName:     queueName,
			Type:          ReportBackfillUserPRsJob,
			CorrelationID: correlationID,
			Subject:       req.UserID,
			DedupeKey:     "report_backfill_user_pull_requests:" + req.UserID,
			MaxAttempts:   maxAttempts,
			Payload: map[string]string{
				"mode":    "report_backfill_user_pull_requests",
				"user_id": req.UserID,
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
	case "backfill_user_history":
		if req.UserID == "" {
			return nil, errors.New("user_id is required when mode=backfill_user_history")
		}
		job, err := NewQueueJob(QueueJobInput{
			QueueName:     queueName,
			Type:          BackfillUserHistoryJob,
			CorrelationID: correlationID,
			Subject:       req.UserID,
			DedupeKey:     "backfill_user_history:" + req.UserID,
			MaxAttempts:   maxAttempts,
			Payload: map[string]string{
				"mode":    "backfill_user_history",
				"user_id": req.UserID,
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
	case "grade_pull_request":
		if req.UserID == "" || req.Repository == "" || req.Number <= 0 {
			return nil, errors.New("user_id, repository, and number are required when mode=grade_pull_request")
		}
		subject := req.Repository + "#" + strconv.Itoa(req.Number)
		job, err := NewQueueJob(QueueJobInput{
			QueueName:     queueName,
			Type:          GradePullRequestJob,
			CorrelationID: correlationID,
			Repository:    req.Repository,
			Subject:       subject,
			DedupeKey:     "grade_pull_request:" + req.UserID + ":" + subject,
			MaxAttempts:   maxAttempts,
			Payload: map[string]any{
				"mode":       "grade_pull_request",
				"user_id":    req.UserID,
				"repository": req.Repository,
				"number":     req.Number,
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
	case "score_replay":
		if req.UserID == "" {
			return nil, errors.New("user_id is required when mode=score_replay")
		}
		job, err := NewQueueJob(QueueJobInput{
			QueueName:     queueName,
			Type:          ScoreReplayUserJob,
			CorrelationID: correlationID,
			Subject:       req.UserID,
			DedupeKey:     "score_replay:" + req.UserID,
			MaxAttempts:   maxAttempts,
			Payload: map[string]string{
				"mode":    "score_replay",
				"user_id": req.UserID,
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
	case "profile_refresh":
		if req.UserID == "" {
			return nil, errors.New("user_id is required when mode=profile_refresh")
		}
		job, err := NewQueueJob(QueueJobInput{
			QueueName:     queueName,
			Type:          ProfileRefreshUserJob,
			CorrelationID: correlationID,
			Subject:       req.UserID,
			DedupeKey:     "profile_refresh:" + req.UserID,
			MaxAttempts:   maxAttempts,
			Payload: map[string]string{
				"mode":    "profile_refresh",
				"user_id": req.UserID,
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
	case "leaderboard_materialize_season":
		job, err := NewQueueJob(QueueJobInput{
			QueueName:     queueName,
			Type:          LeaderboardMaterializeJob,
			CorrelationID: correlationID,
			Subject:       "current",
			DedupeKey:     "leaderboard_materialize_season:current",
			MaxAttempts:   maxAttempts,
			Payload: map[string]string{
				"mode": "leaderboard_materialize_season",
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
	case "leaderboard_backfill_history":
		job, err := NewQueueJob(QueueJobInput{
			QueueName:     queueName,
			Type:          LeaderboardHistoryJob,
			CorrelationID: correlationID,
			Subject:       "history",
			DedupeKey:     "leaderboard_backfill_history:global",
			MaxAttempts:   maxAttempts,
			Payload: map[string]string{
				"mode": "leaderboard_backfill_history",
			},
		})
		if err != nil {
			return nil, err
		}
		return []QueueJob{job}, nil
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
		dedupeKey = mode + ":" + subject
	}
	if sha != "" {
		subject = repository + "@" + sha
		payload["sha"] = sha
		dedupeKey = mode + ":" + subject
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
