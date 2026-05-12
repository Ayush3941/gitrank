package contracts

import "testing"

func TestSyncRequestNormalizeAcceptsSafeRepositoryTargets(t *testing.T) {
	req := SyncRequest{
		Mode:       "repository",
		Repository: " octo/repo.name_1 ",
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.Repository != "octo/repo.name_1" {
		t.Fatalf("Repository = %q, want octo/repo.name_1", req.Repository)
	}
}

func TestSyncRequestNormalizeRejectsUnsafeRepositoryTargets(t *testing.T) {
	cases := []string{
		"https://github.com/octo/repo",
		"octo/repo/extra",
		"octo/repo?x=http://169.254.169.254",
		"octo\\repo",
		"-octo/repo",
		"octo/..",
	}
	for _, repository := range cases {
		t.Run(repository, func(t *testing.T) {
			req := SyncRequest{Mode: "repository", Repository: repository}
			if err := req.Normalize(); err == nil {
				t.Fatal("Normalize() error = nil, want rejection")
			}
		})
	}
}

func TestSyncRequestNormalizeValidatesCommitSHA(t *testing.T) {
	req := SyncRequest{
		Mode:       "commit",
		Repository: "octo/repo",
		SHA:        "ABC123",
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.SHA != "abc123" {
		t.Fatalf("SHA = %q, want abc123", req.SHA)
	}

	req = SyncRequest{Mode: "commit", Repository: "octo/repo", SHA: "main"}
	if err := req.Normalize(); err == nil {
		t.Fatal("Normalize() error = nil, want non-hex sha rejection")
	}
}

func TestSyncRequestNormalizeAcceptsAnalysisPullRequestTarget(t *testing.T) {
	req := SyncRequest{
		Mode:       "analysis_pull_request",
		Repository: "octo/repo",
		Number:     17,
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.Repository != "octo/repo" || req.Number != 17 {
		t.Fatalf("request = %+v, want normalized analysis PR target", req)
	}
}

func TestSyncRequestNormalizeAcceptsReportMaterializePullRequestTarget(t *testing.T) {
	req := SyncRequest{
		Mode:       "report_materialize_pull_request",
		Repository: "octo/repo",
		Number:     17,
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.Repository != "octo/repo" || req.Number != 17 {
		t.Fatalf("request = %+v, want normalized report materialization PR target", req)
	}
}

func TestSyncRequestNormalizeValidatesReportBackfillUserID(t *testing.T) {
	req := SyncRequest{
		Mode:   "report_backfill_user_pull_requests",
		UserID: "8F0C38C9-671F-499D-A1B7-1F9F4F57CBB4",
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.UserID != "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4" {
		t.Fatalf("UserID = %q, want canonical lowercase UUID", req.UserID)
	}

	req = SyncRequest{Mode: "report_backfill_user_pull_requests", UserID: "octocat"}
	if err := req.Normalize(); err == nil {
		t.Fatal("Normalize() error = nil, want invalid user_id rejection")
	}
}

func TestSyncRequestNormalizeValidatesBackfillUserHistoryUserID(t *testing.T) {
	req := SyncRequest{
		Mode:   "backfill_user_history",
		UserID: "8F0C38C9-671F-499D-A1B7-1F9F4F57CBB4",
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.UserID != "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4" {
		t.Fatalf("UserID = %q, want canonical lowercase UUID", req.UserID)
	}

	req = SyncRequest{Mode: "backfill_user_history", UserID: "octocat"}
	if err := req.Normalize(); err == nil {
		t.Fatal("Normalize() error = nil, want invalid user_id rejection")
	}
}

func TestSyncRequestNormalizeAcceptsLeaderboardMaterializeSeason(t *testing.T) {
	req := SyncRequest{Mode: "leaderboard_materialize_season"}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.Mode != "leaderboard_materialize_season" {
		t.Fatalf("Mode = %q, want leaderboard materialization mode", req.Mode)
	}
}

func TestSyncRequestNormalizeAcceptsLeaderboardBackfillHistory(t *testing.T) {
	req := SyncRequest{Mode: "leaderboard_backfill_history"}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.Mode != "leaderboard_backfill_history" {
		t.Fatalf("Mode = %q, want leaderboard backfill history mode", req.Mode)
	}
}

func TestSyncRequestNormalizeValidatesScoreReplayUserID(t *testing.T) {
	req := SyncRequest{
		Mode:   "score_replay",
		UserID: "8F0C38C9-671F-499D-A1B7-1F9F4F57CBB4",
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.UserID != "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4" {
		t.Fatalf("UserID = %q, want canonical lowercase UUID", req.UserID)
	}

	req = SyncRequest{Mode: "score_replay", UserID: "octocat"}
	if err := req.Normalize(); err == nil {
		t.Fatal("Normalize() error = nil, want invalid user_id rejection")
	}
}

func TestSyncRequestNormalizeValidatesProfileRefreshUserID(t *testing.T) {
	req := SyncRequest{
		Mode:   "profile_refresh",
		UserID: "8F0C38C9-671F-499D-A1B7-1F9F4F57CBB4",
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.UserID != "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4" {
		t.Fatalf("UserID = %q, want canonical lowercase UUID", req.UserID)
	}

	req = SyncRequest{Mode: "profile_refresh", UserID: "octocat"}
	if err := req.Normalize(); err == nil {
		t.Fatal("Normalize() error = nil, want invalid user_id rejection")
	}
}

func TestSyncRequestNormalizeAcceptsGradePullRequestTarget(t *testing.T) {
	req := SyncRequest{
		Mode:       "grade_pull_request",
		UserID:     "8F0C38C9-671F-499D-A1B7-1F9F4F57CBB4",
		Repository: "octo/repo",
		Number:     17,
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.UserID != "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4" || req.Repository != "octo/repo" || req.Number != 17 {
		t.Fatalf("request = %+v, want normalized grade PR target", req)
	}
}
