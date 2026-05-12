package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMaterializeQuestBoardPersistsQuestEvidenceAndRewards(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_PROFILE_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_PROFILE_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	store := NewStore(pool)
	rawNow := time.Now().UTC()
	now := rawNow.Truncate(time.Second)
	suffix := rawNow.UnixNano() % 1000000000
	handle := fmt.Sprintf("quest-%d", suffix)

	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (display_name, public_handle, avatar_url)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, "Quest Materialization User", handle, "https://avatars.example.test/u/quest").Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	var githubAccountID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO github_accounts (user_id, github_user_id, login, node_id)
		VALUES ($1::uuid, $2, $3, $4)
		RETURNING id::text
	`, userID, 8000000000+suffix, handle, fmt.Sprintf("U_quest_%d", suffix)).Scan(&githubAccountID); err != nil {
		t.Fatalf("insert github account: %v", err)
	}

	var repositoryID string
	repository := handle + "/repo"
	if err := pool.QueryRow(ctx, `
		INSERT INTO repositories (github_repository_id, owner_login, name, full_name)
		VALUES ($1, $2, 'repo', $3)
		RETURNING id::text
	`, 8100000000+suffix, handle, repository).Scan(&repositoryID); err != nil {
		t.Fatalf("insert repository: %v", err)
	}

	var pullRequestID string
	number := int(suffix%1000) + 10
	if err := pool.QueryRow(ctx, `
		INSERT INTO pull_requests (
			github_pull_request_id,
			repository_id,
			author_github_account_id,
			number,
			title,
			state,
			merged,
			merged_at,
			created_at_source,
			updated_at_source
		) VALUES (
			$1,
			$2::uuid,
			$3::uuid,
			$4,
			'test: add regression coverage',
			'closed',
			true,
			$5,
			$6,
			$7
		)
		RETURNING id::text
	`, 8200000000+suffix, repositoryID, githubAccountID, number, now.Add(-2*time.Hour), now.Add(-3*time.Hour), now.Add(-time.Hour)).Scan(&pullRequestID); err != nil {
		t.Fatalf("insert pull request: %v", err)
	}

	scoreEventIDs := make([]string, 0, 2)
	for i, explanation := range []string{"Added regression test coverage", "Expanded test coverage for edge cases"} {
		var scoreEventID string
		if err := pool.QueryRow(ctx, `
			INSERT INTO score_events (
				user_id,
				pull_request_id,
				score_version,
				event_type,
				delta_total_xp,
				delta_skill_jsonb,
				explanation_jsonb,
				metadata_jsonb,
				created_at
			) VALUES (
				$1::uuid,
				$2::uuid,
				'score/v-quest-test',
				'score.computed',
				120,
				'{"testing":120}'::jsonb,
				jsonb_build_array($3::text),
				'{"score_formula_inputs_version":"score-components/v1"}'::jsonb,
				$4
			)
			RETURNING id::text
		`, userID, pullRequestID, explanation, now.Add(time.Duration(-30+i)*time.Minute)).Scan(&scoreEventID); err != nil {
			t.Fatalf("insert score event %d: %v", i, err)
		}
		scoreEventIDs = append(scoreEventIDs, scoreEventID)
	}

	snapshot := snapshotRecord{
		UserID:          userID,
		SnapshotVersion: profileSnapshotVersion,
		TopSkills: []contracts.SkillAreaView{
			{Key: "backend", TotalXP: 700},
			{Key: "testing", TotalXP: 240},
		},
		ScoreHistory: []contracts.ScoreHistoryEntry{
			questScoreHistory(scoreEventIDs[0], repository, number, "Added regression test coverage", now.Add(-30*time.Minute)),
			questScoreHistory(scoreEventIDs[1], repository, number, "Expanded test coverage for edge cases", now.Add(-29*time.Minute)),
		},
		RefreshedAt:     now,
		StaleAfter:      now.Add(time.Hour),
		SourceWatermark: now,
	}

	materialized, err := store.MaterializeQuestBoard(ctx, userID, snapshot, buildQuestsFromSnapshot(snapshot, now), now)
	if err != nil {
		t.Fatalf("MaterializeQuestBoard() error = %v", err)
	}
	regressionQuest := questByID(materialized, "quest-regression-tests")
	if regressionQuest == nil || regressionQuest.Status != "Completed" || regressionQuest.Progress != 2 {
		t.Fatalf("regression quest = %+v, want completed 2/2", regressionQuest)
	}

	assertQuestMaterialization(t, ctx, pool, userID, "quest-regression-tests", pullRequestID)
}

func questScoreHistory(eventID, repository string, number int, explanation string, createdAt time.Time) contracts.ScoreHistoryEntry {
	return contracts.ScoreHistoryEntry{
		EventID:       eventID,
		EventType:     "score.computed",
		DeltaXP:       120,
		ScoreVersion:  "score/v-quest-test",
		CreatedAt:     createdAt,
		Explanation:   []string{explanation},
		PullRequestID: "linked",
		PullRequest: &contracts.PullRequestReference{
			Repository: repository,
			Number:     number,
			Title:      explanation,
		},
	}
}

func assertQuestMaterialization(t *testing.T, ctx context.Context, pool *pgxpool.Pool, userID, questKey, pullRequestID string) {
	t.Helper()

	var assignmentCount int
	var progress int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*)::int, COALESCE(MAX(uqa.progress), 0)::int
		FROM user_quest_assignments uqa
		INNER JOIN quest_definitions qd ON qd.id = uqa.quest_definition_id
		WHERE uqa.user_id = $1::uuid
		  AND qd.quest_key = $2
		  AND uqa.status = 'completed'
	`, userID, questKey).Scan(&assignmentCount, &progress); err != nil {
		t.Fatalf("load quest assignment: %v", err)
	}
	if assignmentCount != 1 || progress != 2 {
		t.Fatalf("completed quest assignments = %d progress=%d, want one completed 2/2", assignmentCount, progress)
	}

	var progressEvents int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM user_quest_progress_events uqpe
		INNER JOIN quest_definitions qd ON qd.id = uqpe.quest_definition_id
		WHERE uqpe.user_id = $1::uuid
		  AND qd.quest_key = $2
		  AND uqpe.score_event_id IS NOT NULL
		  AND uqpe.pull_request_id = $3::uuid
	`, userID, questKey, pullRequestID).Scan(&progressEvents); err != nil {
		t.Fatalf("load quest progress events: %v", err)
	}
	if progressEvents != 2 {
		t.Fatalf("quest progress events = %d, want 2 score-linked PR evidence events", progressEvents)
	}

	var xpGrants, badgeGrants, questRewardScores int
	if err := pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE uqrg.reward_type = 'xp' AND uqrg.score_event_id IS NOT NULL AND uqrg.xp_amount = 240)::int,
			COUNT(*) FILTER (WHERE uqrg.reward_type = 'badge' AND uqrg.user_badge_id IS NOT NULL AND uqrg.badge_key = 'test-builder')::int,
			(
				SELECT COUNT(*)::int
				FROM score_events se
				WHERE se.user_id = $1::uuid
				  AND se.event_type = 'quest.reward'
				  AND se.delta_total_xp = 240
				  AND se.metadata_jsonb->>'quest_id' = $2
			)
		FROM user_quest_reward_grants uqrg
		INNER JOIN quest_definitions qd ON qd.id = uqrg.quest_definition_id
		WHERE uqrg.user_id = $1::uuid
		  AND qd.quest_key = $2
		  AND uqrg.status = 'applied'
	`, userID, questKey).Scan(&xpGrants, &badgeGrants, &questRewardScores); err != nil {
		t.Fatalf("load quest rewards: %v", err)
	}
	if xpGrants != 1 || badgeGrants != 1 || questRewardScores != 1 {
		t.Fatalf("quest rewards xp=%d badge=%d score_events=%d, want 1/1/1", xpGrants, badgeGrants, questRewardScores)
	}

	var badgeHasPREvidence bool
	if err := pool.QueryRow(ctx, `
		SELECT COALESCE(evidence_jsonb->'evidence_pr_ids', '[]'::jsonb) ? $3
		FROM user_badges
		WHERE user_id = $1::uuid
		  AND badge_key = $2
	`, userID, "test-builder", pullRequestID).Scan(&badgeHasPREvidence); err != nil {
		t.Fatalf("load quest badge evidence: %v", err)
	}
	if !badgeHasPREvidence {
		t.Fatalf("quest reward badge is missing PR evidence id %s", pullRequestID)
	}
}
