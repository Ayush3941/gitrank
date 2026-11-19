package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/authkit"
	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

type profileIntegrityFixture struct {
	ctx                                     context.Context
	pool                                    *pgxpool.Pool
	svc                                     *Service
	userID, accountID, repoID, prID, handle string
	now, occurred                           time.Time
}

func profileIntegrationConfig(databaseURL string) config.App {
	return config.App{
		ServiceName: "profile-service", Database: config.Database{URL: databaseURL},
		Auth:    config.Auth{SessionSecret: "profile-integrity-test-session-secret", SessionCookieName: "gitrank_session", CSRFCookieName: "gitrank_csrf"},
		Scoring: config.DefaultScoringPolicy(),
		Profile: config.Profile{PublicCacheTTL: 5 * time.Minute, PrivateCacheTTL: 2 * time.Minute, SnapshotStaleTTL: 15 * time.Minute, RecentReportsDefaultLimit: 4, RecentReportsMaxLimit: 10, ReportBackfillDefaultLimit: 50, ReportBackfillMaxLimit: 200, AccountExportAuditLimit: 200},
	}
}

func newProfileIntegrityFixture(t *testing.T) *profileIntegrityFixture {
	t.Helper()
	databaseURL := os.Getenv("GITRANK_PROFILE_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("GITRANK_PROFILE_DATABASE_URL is not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	cfg := profileIntegrationConfig(databaseURL)
	svc, err := New(cfg, pool, &Cache{}, profileTestLogger())
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	suffix := time.Now().UnixNano() % 1000000000
	f := &profileIntegrityFixture{ctx: ctx, pool: pool, svc: svc, now: now, occurred: now.Add(-24 * time.Hour), handle: fmt.Sprintf("integrity-%d", suffix)}
	if err := pool.QueryRow(ctx, `INSERT INTO users(display_name,public_handle) VALUES($1,$1) RETURNING id::text`, f.handle).Scan(&f.userID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id=$1::uuid`, f.userID)
		if f.repoID != "" {
			_, _ = pool.Exec(ctx, `DELETE FROM repositories WHERE id=$1::uuid`, f.repoID)
		}
	})
	if err := pool.QueryRow(ctx, `INSERT INTO github_accounts(user_id,github_user_id,login,node_id) VALUES($1::uuid,$2,$3,$3) RETURNING id::text`, f.userID, 9000000000+suffix, f.handle).Scan(&f.accountID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO repositories(github_repository_id,owner_login,name,full_name,stars_count) VALUES($1,$2,'repo',$3,100) RETURNING id::text`, 10000000000+suffix, f.handle, f.handle+"/repo").Scan(&f.repoID); err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(map[string]any{"user": map[string]any{"login": f.handle}, "merged_by": map[string]any{"login": "other-maintainer"}})
	if err := pool.QueryRow(ctx, `INSERT INTO pull_requests(github_pull_request_id,repository_id,author_github_account_id,number,title,state,merged,merged_at,created_at_source,updated_at_source,changed_files,additions,deletions,payload_jsonb) VALUES($1,$2::uuid,$3::uuid,1,'fix: harden API','closed',true,$4,$4,$4,2,120,10,$5::jsonb) RETURNING id::text`, 11000000000+suffix, f.repoID, f.accountID, f.occurred, string(payload)).Scan(&f.prID); err != nil {
		t.Fatal(err)
	}
	return f
}

func (f *profileIntegrityFixture) score(t *testing.T, eventType string, xp int, when time.Time, replayID string) string {
	t.Helper()
	version := "v1alpha1"
	if eventType == "quest.reward" {
		version = "quest-rewards/v1"
	}
	metadata, _ := json.Marshal(map[string]any{"category": "feature", "total_xp": xp, "score_formula_inputs_version": "score-components/v1alpha1"})
	var id string
	err := f.pool.QueryRow(f.ctx, `INSERT INTO score_events(user_id,pull_request_id,replay_run_id,score_version,event_type,delta_total_xp,delta_skill_jsonb,explanation_jsonb,metadata_jsonb,created_at) VALUES($1::uuid,$2::uuid,NULLIF($3,'')::uuid,$4,$5,$6,'{"backend":10}'::jsonb,'[]'::jsonb,$7::jsonb,$8) RETURNING id::text`, f.userID, f.prID, replayID, version, eventType, xp, string(metadata), when).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func (f *profileIntegrityFixture) replay(t *testing.T, when time.Time) string {
	t.Helper()
	var id string
	if err := f.pool.QueryRow(f.ctx, `INSERT INTO score_replay_runs(user_id,score_version,trigger_type,status,created_at) VALUES($1::uuid,'v1alpha1','live','completed',$2) RETURNING id::text`, f.userID, when).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func (f *profileIntegrityFixture) grantPerformanceQuest(t *testing.T, awardAt time.Time) (string, int, string) {
	t.Helper()
	run := f.replay(t, f.now.Add(-time.Minute))
	contributionID := f.score(t, "score.computed", 320, f.occurred, run)
	if _, err := f.pool.Exec(f.ctx, `UPDATE pull_requests SET title='perf: add request latency benchmark' WHERE id=$1::uuid`, f.prID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(f.ctx, `UPDATE score_events SET delta_skill_jsonb='{"performance":320}'::jsonb, metadata_jsonb=metadata_jsonb || '{"category":"performance"}'::jsonb WHERE id=$1::uuid`, contributionID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.svc.RefreshProfileByUserID(f.ctx, f.userID, f.now); err != nil {
		t.Fatal(err)
	}
	backfill, err := f.svc.BackfillQuestsForUser(f.ctx, f.userID, awardAt)
	if err != nil {
		t.Fatal(err)
	}
	if backfill.Completed == 0 {
		t.Fatal("fixture did not qualify for any quest reward")
	}
	var rewardID string
	var total int
	if err := f.pool.QueryRow(f.ctx, `SELECT id::text FROM score_events WHERE user_id=$1::uuid AND event_type='quest.reward' ORDER BY created_at DESC LIMIT 1`, f.userID).Scan(&rewardID); err != nil {
		t.Fatal(err)
	}
	if err := f.pool.QueryRow(f.ctx, `SELECT SUM(delta_total_xp)::int FROM score_events WHERE user_id=$1::uuid`, f.userID).Scan(&total); err != nil {
		t.Fatal(err)
	}
	if total <= 320 {
		t.Fatal("actual quest writer did not grant XP")
	}
	return contributionID, total, rewardID
}

func TestPRReportKeepsContributionXPAfterQuestReward(t *testing.T) {
	f := newProfileIntegrityFixture(t)
	contributionID, _, _ := f.grantPerformanceQuest(t, f.now.Add(time.Second))
	report, err := f.svc.PublicPullRequestReport(f.ctx, f.handle, "repo", 1, f.now)
	if err != nil {
		t.Fatal(err)
	}
	if report.Contribution.XPEarned != 320 || report.Contribution.ID != contributionID {
		t.Errorf("quest reward replaced the PR's 320 XP contribution award")
	}
}

func TestPRReportSelectsNewestReplay(t *testing.T) {
	f := newProfileIntegrityFixture(t)
	oldRun := f.replay(t, f.now.Add(-10*time.Minute))
	f.score(t, "score.computed", 100, f.occurred, oldRun)
	newRun := f.replay(t, f.now.Add(-5*time.Minute))
	expectedID := f.score(t, "score.computed", 200, f.occurred, newRun)
	report, err := f.svc.PublicPullRequestReport(f.ctx, f.handle, "repo", 1, f.now)
	if err != nil {
		t.Fatal(err)
	}
	if report.Contribution.ID != expectedID || report.Contribution.XPEarned != 200 {
		t.Errorf("report did not select the latest replay; both event timestamps represent the same PR outcome")
	}
}

func TestLeaderboardOptOutTakesEffectImmediately(t *testing.T) {
	f := newProfileIntegrityFixture(t)
	f.score(t, "score.computed", 100000, f.occurred, "")
	if _, err := f.svc.RefreshProfileByUserID(f.ctx, f.userID, f.now.Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	first, err := f.svc.Leaderboard(f.ctx, 100, f.now)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, row := range first.Entries {
		if row.Handle == f.handle {
			found = true
		}
	}
	if !found {
		t.Fatal("fixture must appear before opt out")
	}
	disabled := false
	if _, err := f.svc.store.UpdateProfileSettings(f.ctx, f.userID, contracts.UpdateProfilePrivacyRequest{ShowLeaderboardParticipation: &disabled}, f.now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	second, err := f.svc.Leaderboard(f.ctx, 100, f.now.Add(2*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range second.Entries {
		if row.Handle == f.handle {
			t.Errorf("opted-out user remains in fresh leaderboard season snapshot")
		}
	}
	afterTTL, err := f.svc.Leaderboard(f.ctx, 100, f.now.Add(6*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range afterTTL.Entries {
		if row.Handle == f.handle {
			t.Fatal("user still listed after rematerialization")
		}
	}
}

func TestWeeklyXPDoesNotReuseOldSeasonBucket(t *testing.T) {
	f := newProfileIntegrityFixture(t)
	old := f.now.AddDate(0, 0, -14)
	f.score(t, "score.computed", 320, old, "")
	if _, err := f.svc.RefreshProfileByUserID(f.ctx, f.userID, old.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, _, err := f.svc.store.MaterializeLeaderboardSeason(f.ctx, f.now, 100); err != nil {
		t.Fatal(err)
	}
	board, err := f.svc.Leaderboard(f.ctx, 100, f.now)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, row := range board.Entries {
		if row.Handle == f.handle {
			found = true
			if row.WeeklyXP != 0 {
				t.Errorf("two-week-old XP appears as current-season weekly XP")
			}
		}
	}
	if !found {
		t.Fatal("fixture missing from leaderboard")
	}
}

func TestQuestAwardIsVisibleInFreshProfile(t *testing.T) {
	f := newProfileIntegrityFixture(t)
	_, expectedTotal, _ := f.grantPerformanceQuest(t, f.now.Add(time.Second))
	profile, err := f.svc.PublicProfile(f.ctx, f.handle, f.now.Add(2*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if profile.Summary.TotalXP != expectedTotal {
		t.Errorf("fresh profile snapshot omits the newly granted quest reward")
	}
	refreshed, err := f.svc.RefreshProfileByUserID(f.ctx, f.userID, f.now.Add(3*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if refreshed.TotalXP != expectedTotal {
		t.Errorf("forced refresh XP=%d, expected %d", refreshed.TotalXP, expectedTotal)
	}
}

func TestQuestRefreshAtSameLogicalTimeKeepsLatestSnapshot(t *testing.T) {
	f := newProfileIntegrityFixture(t)
	_, expected, _ := f.grantPerformanceQuest(t, f.now)
	latest, err := f.svc.store.LoadLatestSnapshot(f.ctx, f.userID)
	if err != nil || latest.TotalXP != expected || !latest.StaleAfter.After(f.now) {
		t.Fatalf("latest snapshot XP=%d, stale_after=%s, error=%v", latest.TotalXP, latest.StaleAfter, err)
	}
	if _, err := f.svc.BackfillQuestsForUser(f.ctx, f.userID, f.now); err != nil {
		t.Fatal(err)
	}
	var total int
	if err := f.pool.QueryRow(f.ctx, `SELECT SUM(delta_total_xp)::int FROM score_events WHERE user_id=$1::uuid`, f.userID).Scan(&total); err != nil {
		t.Fatal(err)
	}
	if total != expected {
		t.Fatalf("re-reading the quest board granted XP again: total=%d, expected=%d", total, expected)
	}
}

func (f *profileIntegrityFixture) session(t *testing.T) string {
	t.Helper()
	token := "profile-integrity-session-" + f.userID
	hash, err := authkit.HashOpaqueToken([]byte(f.svc.cfg.Auth.SessionSecret), token)
	if err != nil {
		t.Fatal(err)
	}
	_, err = f.pool.Exec(f.ctx, `
		INSERT INTO auth_sessions(user_id, github_account_id, session_token_hash, csrf_token_hash, expires_at, idle_expires_at)
		VALUES ($1::uuid, $2::uuid, $3, 'unused-for-read', $4, $4)
	`, f.userID, f.accountID, hash, f.now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func TestPRReportPrivacyPreservesOwnerAccess(t *testing.T) {
	for _, control := range []string{"profile", "exact_prs", "repository"} {
		t.Run(control, func(t *testing.T) {
			f := newProfileIntegrityFixture(t)
			f.score(t, "score.computed", 320, f.occurred, "")
			ownerToken := f.session(t)
			other := newProfileIntegrityFixture(t)
			otherToken := other.session(t)
			disabled := false
			switch control {
			case "profile":
				_, err := f.svc.store.UpdateProfileSettings(f.ctx, f.userID, contracts.UpdateProfilePrivacyRequest{PublicProfileEnabled: &disabled}, f.now)
				if err != nil {
					t.Fatal(err)
				}
			case "exact_prs":
				_, err := f.svc.store.UpdateProfileSettings(f.ctx, f.userID, contracts.UpdateProfilePrivacyRequest{ShowExactPRs: &disabled}, f.now)
				if err != nil {
					t.Fatal(err)
				}
			case "repository":
				_, err := f.svc.store.UpsertRepositoryVisibility(f.ctx, f.userID, f.handle+"/repo", "hidden", "privacy test", f.now)
				if err != nil {
					t.Fatal(err)
				}
			}
			for _, token := range []string{"", "invalid-session", otherToken} {
				if _, err := f.svc.PullRequestReport(f.ctx, token, f.handle, "repo", 1, f.now); !errors.Is(err, ErrNotFound) {
					t.Errorf("reader must not see unpublished report: %v", err)
				}
			}
			ownerReport, err := f.svc.PullRequestReport(f.ctx, ownerToken, f.handle, "repo", 1, f.now)
			if err != nil || ownerReport.Contribution.XPEarned != 320 {
				t.Fatalf("owner report XP=%d, error=%v", ownerReport.Contribution.XPEarned, err)
			}
			if _, err := f.svc.InternalPullRequestReport(f.ctx, f.handle, "repo", 1, f.now); err != nil {
				t.Fatalf("scheduler readback: %v", err)
			}
		})
	}
}

func TestPRReportAppliesPrivacyWithoutAuthorAccountID(t *testing.T) {
	f := newProfileIntegrityFixture(t)
	f.score(t, "score.computed", 320, f.occurred, "")
	if _, err := f.pool.Exec(f.ctx, `UPDATE pull_requests SET author_github_account_id = NULL WHERE id = $1::uuid`, f.prID); err != nil {
		t.Fatal(err)
	}
	disabled := false
	if _, err := f.svc.store.UpdateProfileSettings(f.ctx, f.userID, contracts.UpdateProfilePrivacyRequest{ShowExactPRs: &disabled}, f.now); err != nil {
		t.Fatal(err)
	}
	if _, err := f.svc.PublicPullRequestReport(f.ctx, f.handle, "repo", 1, f.now); !errors.Is(err, ErrNotFound) {
		t.Fatalf("login-linked hidden report: %v", err)
	}
}

func TestPRReportRespectsSummaryGenerationPrivacy(t *testing.T) {
	f := newProfileIntegrityFixture(t)
	f.score(t, "score.computed", 320, f.occurred, "")
	if _, err := f.pool.Exec(f.ctx, `INSERT INTO contribution_analyses(pull_request_id, analyzer_version, classification, confidence) VALUES($1::uuid, 'test', 'feature', 0.9)`, f.prID); err != nil {
		t.Fatal(err)
	}
	disabled := false
	if _, err := f.svc.store.UpdateProfileSettings(f.ctx, f.userID, contracts.UpdateProfilePrivacyRequest{ShowAISummaries: &disabled}, f.now); err != nil {
		t.Fatal(err)
	}
	report, err := f.svc.PublicPullRequestReport(f.ctx, f.handle, "repo", 1, f.now)
	if err != nil {
		t.Fatal(err)
	}
	if report.AISummaryVisible == nil || *report.AISummaryVisible {
		t.Fatalf("AI narrative remains public: %+v", report)
	}
	ownerReport, err := f.svc.PullRequestReport(f.ctx, f.session(t), f.handle, "repo", 1, f.now)
	if err != nil {
		t.Fatalf("owner report unavailable: %v", err)
	}
	if ownerReport.AISummaryVisible != nil && !*ownerReport.AISummaryVisible {
		t.Fatal("owner cannot generate their own explanation")
	}
}

func TestLeaderboardRanksEachLaneBeforeApplyingLimit(t *testing.T) {
	target := newProfileIntegrityFixture(t)
	_, start, _ := currentLeaderboardSeason(target.now)
	when := start.Add(target.now.Sub(start) / 2)
	eventID := target.score(t, "score.computed", 1000, when, "")
	if _, err := target.pool.Exec(target.ctx, `UPDATE score_events SET delta_skill_jsonb = '{"backend":700,"testing":300}'::jsonb WHERE id = $1::uuid`, eventID); err != nil {
		t.Fatal(err)
	}
	if _, err := target.svc.RefreshProfileByUserID(target.ctx, target.userID, target.now); err != nil {
		t.Fatal(err)
	}
	for index := 0; index < 50; index++ {
		leader := newProfileIntegrityFixture(t)
		id := leader.score(t, "score.computed", 10000+index, start.Add(-time.Hour), "")
		skills, err := json.Marshal(map[string]int{"backend": 9999 + index, "testing": 1})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := leader.pool.Exec(leader.ctx, `UPDATE score_events SET delta_skill_jsonb=$2::jsonb WHERE id=$1::uuid`, id, string(skills)); err != nil {
			t.Fatal(err)
		}
		if _, err := leader.svc.RefreshProfileByUserID(leader.ctx, leader.userID, leader.now); err != nil {
			t.Fatal(err)
		}
	}
	now := time.Now().UTC().Add(time.Second)
	if _, _, err := target.svc.store.MaterializeLeaderboardSeason(target.ctx, now, 100); err != nil {
		t.Fatal(err)
	}
	global, err := target.svc.Leaderboard(target.ctx, 50, now)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range global.Entries {
		if row.Handle == target.handle {
			t.Fatal("fixture must be outside the global top 50")
		}
	}
	for _, lane := range []contracts.LeaderboardLane{contracts.LeaderboardWeekly, contracts.LeaderboardTesting} {
		board, err := target.svc.LeaderboardForLane(target.ctx, lane, 50, now)
		if err != nil {
			t.Fatal(err)
		}
		if len(board.Entries) == 0 || board.Entries[0].Handle != target.handle || board.Entries[0].Rank != 1 {
			t.Fatalf("%s lane omitted its leading contributor", lane)
		}
		expected := 1000
		if lane == contracts.LeaderboardTesting {
			expected = 300
		}
		if board.Entries[0].RankingValue != expected {
			t.Errorf("%s metric=%d, expected=%d", lane, board.Entries[0].RankingValue, expected)
		}
		_, cached, fresh, err := target.svc.store.loadFreshLeaderboardLane(target.ctx, now.Add(time.Millisecond), 50, lane)
		if err != nil || !fresh || len(cached) == 0 || cached[0].RankingValue != expected {
			t.Fatalf("%s cached lane: fresh=%v, err=%v", lane, fresh, err)
		}
	}
}
