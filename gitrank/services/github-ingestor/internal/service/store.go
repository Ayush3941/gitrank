package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

type TxStore struct {
	ctx context.Context
	tx  pgx.Tx
}

const maxStoredPullRequestFilePatchBytes = 12000

const (
	syncCursorScopeGitHubUserLogin             = "github_user_login"
	authoredPRCursorResourceLastSyncedAt       = "authored_pr_last_synced_at"
	authoredPRCursorResourceOldestSeenAt       = "authored_pr_oldest_seen_at"
	authoredPRCursorResourceBackfillBeforeAt   = "authored_pr_backfill_before_at"
	authoredPRCursorResourceBootstrapCompleted = "authored_pr_bootstrap_completed"
)

type authoredPRHistoryCursor struct {
	LastSyncedAt      *time.Time
	OldestSeenAt      *time.Time
	BackfillBeforeAt  *time.Time
	BootstrapComplete bool
}

type payloadSyncRunInput struct {
	CorrelationID               string
	DeliveryID                  string
	EventType                   string
	Status                      string
	LastError                   string
	Subject                     string
	InstallationID              string
	InstallationSourceID        int64
	RepositoryID                string
	RequestedUserLogin          string
	RequestedRepositoryFullName string
	RequestedBySubject          string
	RequestedByGitHubLogin      string
	Result                      PersistResult
	Fetched                     map[string]int
	StartedAt                   time.Time
	FinishedAt                  *time.Time
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Ping(ctx context.Context) error {
	if s == nil || s.pool == nil {
		return nil
	}
	return s.pool.Ping(ctx)
}

func (s *Store) WithTx(ctx context.Context, fn func(*TxStore) (PersistResult, error)) (PersistResult, error) {
	if s == nil || s.pool == nil {
		return PersistResult{}, ErrUnavailable
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return PersistResult{}, err
	}
	defer tx.Rollback(ctx)

	result, err := fn(&TxStore{ctx: ctx, tx: tx})
	if err != nil {
		return PersistResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return PersistResult{}, err
	}
	return result, nil
}

func (s *Store) ActiveInstallationRepositories(ctx context.Context, githubInstallationID int64) (string, []string, error) {
	if s == nil || s.pool == nil {
		return "", nil, ErrUnavailable
	}
	if githubInstallationID <= 0 {
		return "", nil, errors.New("installation ID is required")
	}

	var installationID string
	if err := s.pool.QueryRow(ctx, `
		SELECT id::text
		FROM github_installations
		WHERE github_installation_id = $1
		LIMIT 1
	`, githubInstallationID).Scan(&installationID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil, errors.New("installation not found")
		}
		return "", nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT r.full_name
		FROM github_installation_repositories gir
		JOIN repositories r ON r.id = gir.repository_id
		WHERE gir.installation_id = $1::uuid
		  AND gir.removed_at IS NULL
		  AND r.full_name <> ''
		ORDER BY gir.selected_at DESC, r.full_name ASC
	`, installationID)
	if err != nil {
		return installationID, nil, err
	}
	defer rows.Close()

	repositories := make([]string, 0)
	seen := make(map[string]struct{})
	for rows.Next() {
		var fullName string
		if err := rows.Scan(&fullName); err != nil {
			return installationID, nil, err
		}
		fullName = strings.TrimSpace(fullName)
		if fullName == "" {
			continue
		}
		if _, ok := seen[fullName]; ok {
			continue
		}
		seen[fullName] = struct{}{}
		repositories = append(repositories, fullName)
	}
	if err := rows.Err(); err != nil {
		return installationID, nil, err
	}

	return installationID, repositories, nil
}

func (s *Store) ActiveInstallationIDsByAccountLogin(ctx context.Context, githubLogin string) ([]int64, error) {
	if s == nil || s.pool == nil {
		return nil, ErrUnavailable
	}
	githubLogin = strings.TrimSpace(githubLogin)
	if githubLogin == "" {
		return nil, errors.New("github login is required")
	}

	rows, err := s.pool.Query(ctx, `
		SELECT github_installation_id
		FROM github_installations
		WHERE LOWER(account_login) = LOWER($1)
		  AND suspended_at_source IS NULL
		ORDER BY updated_at_source DESC NULLS LAST, updated_at DESC
	`, githubLogin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	installationIDs := make([]int64, 0)
	seen := make(map[int64]struct{})
	for rows.Next() {
		var installationID int64
		if err := rows.Scan(&installationID); err != nil {
			return nil, err
		}
		if installationID <= 0 {
			continue
		}
		if _, ok := seen[installationID]; ok {
			continue
		}
		seen[installationID] = struct{}{}
		installationIDs = append(installationIDs, installationID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return installationIDs, nil
}

func (s *Store) ActiveGitHubAccessTokenByLogin(ctx context.Context, githubLogin string, validAfter time.Time) (string, bool, error) {
	if s == nil || s.pool == nil {
		return "", false, ErrUnavailable
	}
	githubLogin = strings.TrimSpace(githubLogin)
	if githubLogin == "" {
		return "", false, nil
	}

	var encryptedToken string
	err := s.pool.QueryRow(ctx, `
		SELECT gut.access_token_encrypted
		FROM github_accounts ga
		JOIN github_user_tokens gut ON gut.github_account_id = ga.id
		WHERE LOWER(ga.login) = LOWER($1)
		  AND COALESCE(ga.link_status, 'linked') = 'linked'
		  AND gut.access_token_encrypted <> ''
		  AND gut.revoked_at IS NULL
		  AND (gut.expires_at IS NULL OR gut.expires_at > $2)
		ORDER BY ga.linked_at DESC
		LIMIT 1
	`, githubLogin, validAfter.UTC()).Scan(&encryptedToken)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, nil
		}
		return "", false, err
	}
	return encryptedToken, true, nil
}

func (s *Store) CountAuthoredPullRequestsByLogin(ctx context.Context, githubLogin string) (int, error) {
	if s == nil || s.pool == nil {
		return 0, ErrUnavailable
	}
	githubLogin = strings.TrimSpace(githubLogin)
	if githubLogin == "" {
		return 0, errors.New("github login is required")
	}

	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM pull_requests pr
		INNER JOIN github_accounts ga ON ga.id = pr.author_github_account_id
		WHERE LOWER(ga.login) = LOWER($1)
		  AND COALESCE(ga.link_status, 'linked') = 'linked'
	`, githubLogin).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (s *Store) LoadAuthoredPRHistoryCursor(ctx context.Context, githubLogin string) (authoredPRHistoryCursor, error) {
	if s == nil || s.pool == nil {
		return authoredPRHistoryCursor{}, ErrUnavailable
	}
	githubLogin = strings.TrimSpace(githubLogin)
	if githubLogin == "" {
		return authoredPRHistoryCursor{}, errors.New("github login is required")
	}

	rows, err := s.pool.Query(ctx, `
		SELECT resource_name, cursor_value
		FROM github_sync_cursors
		WHERE scope_type = $1
		  AND scope_id = LOWER($2)
		  AND resource_name = ANY($3::text[])
	`, syncCursorScopeGitHubUserLogin, githubLogin, []string{
		authoredPRCursorResourceLastSyncedAt,
		authoredPRCursorResourceOldestSeenAt,
		authoredPRCursorResourceBackfillBeforeAt,
		authoredPRCursorResourceBootstrapCompleted,
	})
	if err != nil {
		return authoredPRHistoryCursor{}, err
	}
	defer rows.Close()

	cursor := authoredPRHistoryCursor{}
	for rows.Next() {
		var resourceName string
		var cursorValue string
		if err := rows.Scan(&resourceName, &cursorValue); err != nil {
			return authoredPRHistoryCursor{}, err
		}

		resourceName = strings.TrimSpace(resourceName)
		cursorValue = strings.TrimSpace(cursorValue)
		if cursorValue == "" {
			continue
		}

		switch resourceName {
		case authoredPRCursorResourceLastSyncedAt:
			timestamp, ok := parseRFC3339CursorTime(cursorValue)
			if ok {
				cursor.LastSyncedAt = &timestamp
			}
		case authoredPRCursorResourceOldestSeenAt:
			timestamp, ok := parseRFC3339CursorTime(cursorValue)
			if ok {
				cursor.OldestSeenAt = &timestamp
			}
		case authoredPRCursorResourceBackfillBeforeAt:
			timestamp, ok := parseRFC3339CursorTime(cursorValue)
			if ok {
				cursor.BackfillBeforeAt = &timestamp
			}
		case authoredPRCursorResourceBootstrapCompleted:
			cursor.BootstrapComplete = cursorValue == "1" || strings.EqualFold(cursorValue, "true")
		}
	}
	if err := rows.Err(); err != nil {
		return authoredPRHistoryCursor{}, err
	}
	return cursor, nil
}

func (s *Store) UpsertAuthoredPRHistoryCursor(ctx context.Context, githubLogin string, cursor authoredPRHistoryCursor, now time.Time) error {
	if s == nil || s.pool == nil {
		return ErrUnavailable
	}
	githubLogin = strings.TrimSpace(strings.ToLower(githubLogin))
	if githubLogin == "" {
		return errors.New("github login is required")
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}

	entries := make(map[string]string, 4)
	if cursor.LastSyncedAt != nil && !cursor.LastSyncedAt.IsZero() {
		entries[authoredPRCursorResourceLastSyncedAt] = cursor.LastSyncedAt.UTC().Format(time.RFC3339)
	}
	if cursor.OldestSeenAt != nil && !cursor.OldestSeenAt.IsZero() {
		entries[authoredPRCursorResourceOldestSeenAt] = cursor.OldestSeenAt.UTC().Format(time.RFC3339)
	}
	if cursor.BackfillBeforeAt != nil && !cursor.BackfillBeforeAt.IsZero() {
		entries[authoredPRCursorResourceBackfillBeforeAt] = cursor.BackfillBeforeAt.UTC().Format(time.RFC3339)
	}
	if cursor.BootstrapComplete {
		entries[authoredPRCursorResourceBootstrapCompleted] = "true"
	} else {
		entries[authoredPRCursorResourceBootstrapCompleted] = "false"
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for resourceName, cursorValue := range entries {
		if _, err := tx.Exec(ctx, `
			INSERT INTO github_sync_cursors (
				scope_type,
				scope_id,
				resource_name,
				cursor_value,
				synced_at
			) VALUES (
				$1, $2, $3, $4, $5
			)
			ON CONFLICT (scope_type, scope_id, resource_name) DO UPDATE SET
				cursor_value = EXCLUDED.cursor_value,
				synced_at = EXCLUDED.synced_at
		`, syncCursorScopeGitHubUserLogin, githubLogin, resourceName, cursorValue, now.UTC()); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func parseRFC3339CursorTime(raw string) (time.Time, bool) {
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(raw))
	if err != nil {
		return time.Time{}, false
	}
	return parsed.UTC(), true
}

func (s *TxStore) UpsertInstallation(payload map[string]any, now time.Time) (string, bool, error) {
	installation := object(payload["installation"])
	if installation == nil {
		return "", false, nil
	}
	githubInstallationID := int64Value(installation["id"])
	if githubInstallationID == 0 {
		return "", false, nil
	}

	account := object(installation["account"])
	permissionsJSON := encodeJSON(installation["permissions"])
	eventsJSON := textArray(installation["events"])

	var installationID string
	err := s.tx.QueryRow(s.context(), `
		INSERT INTO github_installations (
			github_installation_id,
			github_app_id,
			app_slug,
			account_login,
			account_type,
			target_type,
			repository_selection,
			permissions_jsonb,
			events,
			suspended_at_source,
			installed_at_source,
			updated_at_source,
			created_at,
			updated_at
		) VALUES (
			$1, NULLIF($2, 0), $3, $4, $5, $6, $7, $8::jsonb, $9::text[], $10, $11, $12, $12, $12
		)
		ON CONFLICT (github_installation_id) DO UPDATE SET
			github_app_id = EXCLUDED.github_app_id,
			app_slug = EXCLUDED.app_slug,
			account_login = EXCLUDED.account_login,
			account_type = EXCLUDED.account_type,
			target_type = EXCLUDED.target_type,
			repository_selection = EXCLUDED.repository_selection,
			permissions_jsonb = EXCLUDED.permissions_jsonb,
			events = EXCLUDED.events,
			suspended_at_source = EXCLUDED.suspended_at_source,
			installed_at_source = COALESCE(EXCLUDED.installed_at_source, github_installations.installed_at_source),
			updated_at_source = EXCLUDED.updated_at_source,
			updated_at = EXCLUDED.updated_at
		RETURNING id::text
	`,
		githubInstallationID,
		int64Value(installation["app_id"]),
		stringValue(installation["app_slug"]),
		stringValue(account["login"]),
		stringValue(account["type"]),
		stringValue(installation["target_type"]),
		defaultString(stringValue(installation["repository_selection"]), "all"),
		permissionsJSON,
		eventsJSON,
		parseGitHubTime(installation["suspended_at"]),
		parseGitHubTime(installation["created_at"]),
		now.UTC(),
	).Scan(&installationID)
	if err != nil {
		return "", false, err
	}

	if err := s.syncInstallationRepositories(installationID, payload, now.UTC()); err != nil {
		return "", false, err
	}
	return installationID, true, nil
}

func (s *TxStore) UpsertRepository(payload map[string]any, now time.Time) (string, bool, error) {
	repository := object(payload["repository"])
	if repository == nil {
		return "", false, nil
	}
	githubRepositoryID := int64Value(repository["id"])
	if githubRepositoryID == 0 {
		return "", false, nil
	}

	owner := object(repository["owner"])
	var repositoryID string
	err := s.tx.QueryRow(s.context(), `
		INSERT INTO repositories (
			github_repository_id,
			owner_login,
			name,
			full_name,
			is_private,
			is_fork,
			primary_language,
			default_branch,
			stars_count,
			forks_count,
			open_issues_count,
			archived,
			disabled,
			metadata_jsonb,
			synced_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15
		)
		ON CONFLICT (github_repository_id) DO UPDATE SET
			owner_login = EXCLUDED.owner_login,
			name = EXCLUDED.name,
			full_name = EXCLUDED.full_name,
			is_private = EXCLUDED.is_private,
			is_fork = EXCLUDED.is_fork,
			primary_language = EXCLUDED.primary_language,
			default_branch = EXCLUDED.default_branch,
			stars_count = EXCLUDED.stars_count,
			forks_count = EXCLUDED.forks_count,
			open_issues_count = EXCLUDED.open_issues_count,
			archived = EXCLUDED.archived,
			disabled = EXCLUDED.disabled,
			metadata_jsonb = EXCLUDED.metadata_jsonb,
			synced_at = EXCLUDED.synced_at
		RETURNING id::text
	`,
		githubRepositoryID,
		stringValue(owner["login"]),
		stringValue(repository["name"]),
		stringValue(repository["full_name"]),
		boolValue(repository["private"]),
		boolValue(repository["fork"]),
		stringValue(repository["language"]),
		defaultString(stringValue(repository["default_branch"]), "main"),
		intValue(repository["stargazers_count"]),
		intValue(repository["forks_count"]),
		intValue(repository["open_issues_count"]),
		boolValue(repository["archived"]),
		boolValue(repository["disabled"]),
		encodeJSON(repository),
		now.UTC(),
	).Scan(&repositoryID)
	if err != nil {
		return "", false, err
	}
	return repositoryID, true, nil
}

func (s *TxStore) UpsertRepositoryLists(payload map[string]any, now time.Time) (int, error) {
	count := 0
	for _, key := range []string{"repositories", "repositories_added", "repositories_removed"} {
		for _, item := range objectArray(payload[key]) {
			if _, touched, err := s.UpsertRepository(map[string]any{"repository": item}, now.UTC()); err != nil {
				return count, err
			} else if touched {
				count++
			}
		}
	}
	return count, nil
}

func (s *TxStore) UpsertPullRequest(payload map[string]any, repositoryID string, now time.Time) (string, bool, int, error) {
	pr := object(payload["pull_request"])
	if pr == nil || strings.TrimSpace(repositoryID) == "" {
		return "", false, 0, nil
	}
	githubPullRequestID := int64Value(pr["id"])
	if githubPullRequestID == 0 {
		return "", false, 0, nil
	}

	authorAccountID, err := s.lookupAccountIDByGitHubIdentity(object(pr["user"]))
	if err != nil {
		return "", false, 0, err
	}

	var pullRequestID string
	err = s.tx.QueryRow(s.context(), `
		INSERT INTO pull_requests (
			github_pull_request_id,
			repository_id,
			author_github_account_id,
			number,
			title,
			state,
			draft,
			merged,
			merged_at,
			created_at_source,
			updated_at_source,
			closed_at_source,
			base_branch,
			head_branch,
			changed_files,
			additions,
			deletions,
			commits,
			payload_jsonb,
			synced_at
		) VALUES (
			$1,
			$2::uuid,
			NULLIF($3, '')::uuid,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			$10,
			$11,
			$12,
			$13,
			$14,
			$15,
			$16,
			$17,
			$18,
			$19::jsonb,
			$20
		)
		ON CONFLICT (github_pull_request_id) DO UPDATE SET
			repository_id = EXCLUDED.repository_id,
			author_github_account_id = EXCLUDED.author_github_account_id,
			number = EXCLUDED.number,
			title = EXCLUDED.title,
			state = EXCLUDED.state,
			draft = EXCLUDED.draft,
			merged = EXCLUDED.merged,
			merged_at = EXCLUDED.merged_at,
			created_at_source = EXCLUDED.created_at_source,
			updated_at_source = EXCLUDED.updated_at_source,
			closed_at_source = EXCLUDED.closed_at_source,
			base_branch = EXCLUDED.base_branch,
			head_branch = EXCLUDED.head_branch,
			changed_files = EXCLUDED.changed_files,
			additions = EXCLUDED.additions,
			deletions = EXCLUDED.deletions,
			commits = EXCLUDED.commits,
			payload_jsonb = EXCLUDED.payload_jsonb,
			synced_at = EXCLUDED.synced_at
		RETURNING id::text
	`,
		githubPullRequestID,
		repositoryID,
		authorAccountID,
		firstPositiveInt(intValue(payload["number"]), intValue(pr["number"])),
		stringValue(pr["title"]),
		stringValue(pr["state"]),
		boolValue(pr["draft"]),
		boolValue(pr["merged"]),
		parseGitHubTime(pr["merged_at"]),
		coalesceTime(parseGitHubTime(pr["created_at"]), now.UTC()),
		coalesceTime(parseGitHubTime(pr["updated_at"]), now.UTC()),
		parseGitHubTime(pr["closed_at"]),
		stringValue(object(pr["base"])["ref"]),
		stringValue(object(pr["head"])["ref"]),
		intValue(pr["changed_files"]),
		intValue(pr["additions"]),
		intValue(pr["deletions"]),
		intValue(pr["commits"]),
		encodeJSON(pr),
		now.UTC(),
	).Scan(&pullRequestID)
	if err != nil {
		return "", false, 0, err
	}

	labelCount, err := s.syncPullRequestLabels(pullRequestID, repositoryID, objectArray(pr["labels"]), now.UTC())
	if err != nil {
		return "", false, 0, err
	}
	return pullRequestID, true, labelCount, nil
}

func (s *TxStore) UpsertPullRequestFile(file map[string]any, pullRequestID string) (bool, error) {
	if file == nil || strings.TrimSpace(pullRequestID) == "" {
		return false, nil
	}
	path := pullRequestFilePath(file)
	if path == "" {
		return false, nil
	}

	rawPatch := rawStringValue(file["patch"])
	patch := boundedStringBytes(rawPatch, maxStoredPullRequestFilePatchBytes)
	sanitized := sanitizedPullRequestFilePayload(file, patch)
	features := derivePullRequestFileFeatures(file, path, rawPatch, patch)

	tag, err := s.tx.Exec(s.context(), `
		INSERT INTO pull_request_files (
			pull_request_id,
			path,
			previous_path,
			status,
			additions,
			deletions,
			changes,
			patch,
			blob_url,
			raw_url,
			feature_jsonb,
			payload_jsonb
		) VALUES (
			$1::uuid,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			$10,
			$11::jsonb,
			$12::jsonb
		)
		ON CONFLICT (pull_request_id, path) DO UPDATE SET
			previous_path = EXCLUDED.previous_path,
			status = EXCLUDED.status,
			additions = EXCLUDED.additions,
			deletions = EXCLUDED.deletions,
			changes = EXCLUDED.changes,
			patch = EXCLUDED.patch,
			blob_url = EXCLUDED.blob_url,
			raw_url = EXCLUDED.raw_url,
			feature_jsonb = EXCLUDED.feature_jsonb,
			payload_jsonb = EXCLUDED.payload_jsonb
	`, pullRequestID,
		path,
		stringValue(file["previous_filename"]),
		stringValue(file["status"]),
		intValue(file["additions"]),
		intValue(file["deletions"]),
		intValue(file["changes"]),
		patch,
		stringValue(file["blob_url"]),
		stringValue(file["raw_url"]),
		encodeJSON(features),
		encodeJSON(sanitized),
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (s *TxStore) UpsertReview(payload map[string]any, pullRequestID string, now time.Time) (bool, error) {
	review := object(payload["review"])
	if review == nil || strings.TrimSpace(pullRequestID) == "" {
		return false, nil
	}
	githubReviewID := int64Value(review["id"])
	if githubReviewID == 0 {
		return false, nil
	}
	reviewerAccountID, err := s.lookupAccountIDByGitHubIdentity(object(review["user"]))
	if err != nil {
		return false, err
	}
	_, err = s.tx.Exec(s.context(), `
		INSERT INTO pull_request_reviews (
			github_review_id,
			pull_request_id,
			reviewer_github_account_id,
			state,
			submitted_at_source,
			body,
			payload_jsonb
		) VALUES (
			$1,
			$2::uuid,
			NULLIF($3, '')::uuid,
			$4,
			$5,
			$6,
			$7::jsonb
		)
		ON CONFLICT (github_review_id) DO UPDATE SET
			pull_request_id = EXCLUDED.pull_request_id,
			reviewer_github_account_id = EXCLUDED.reviewer_github_account_id,
			state = EXCLUDED.state,
			submitted_at_source = EXCLUDED.submitted_at_source,
			body = EXCLUDED.body,
			payload_jsonb = EXCLUDED.payload_jsonb
	`,
		githubReviewID,
		pullRequestID,
		reviewerAccountID,
		strings.ToUpper(defaultString(stringValue(review["state"]), "COMMENTED")),
		parseGitHubTime(review["submitted_at"]),
		stringValue(review["body"]),
		encodeJSON(review),
	)
	return err == nil, err
}

func (s *TxStore) UpsertReviewFromComment(payload map[string]any, pullRequestID string, now time.Time) (bool, string, error) {
	review := object(payload["review"])
	if review != nil {
		touched, err := s.UpsertReview(payload, pullRequestID, now.UTC())
		if err != nil {
			return false, "", err
		}
		reviewID, err := s.lookupReviewIDByGitHubID(int64Value(review["id"]))
		return touched, reviewID, err
	}
	comment := object(payload["comment"])
	if comment == nil {
		return false, "", nil
	}
	reviewID, err := s.lookupReviewIDByGitHubID(int64Value(comment["pull_request_review_id"]))
	return false, reviewID, err
}

func (s *TxStore) UpsertReviewComment(payload map[string]any, pullRequestID, reviewID string, now time.Time) (bool, error) {
	comment := object(payload["comment"])
	if comment == nil || strings.TrimSpace(pullRequestID) == "" {
		return false, nil
	}
	githubCommentID := int64Value(comment["id"])
	if githubCommentID == 0 {
		return false, nil
	}
	authorAccountID, err := s.lookupAccountIDByGitHubIdentity(object(comment["user"]))
	if err != nil {
		return false, err
	}
	_, err = s.tx.Exec(s.context(), `
		INSERT INTO pull_request_review_comments (
			github_review_comment_id,
			pull_request_id,
			review_id,
			author_github_account_id,
			path,
			position,
			body,
			created_at_source,
			payload_jsonb
		) VALUES (
			$1,
			$2::uuid,
			NULLIF($3, '')::uuid,
			NULLIF($4, '')::uuid,
			$5,
			NULLIF($6, 0),
			$7,
			$8,
			$9::jsonb
		)
		ON CONFLICT (github_review_comment_id) DO UPDATE SET
			pull_request_id = EXCLUDED.pull_request_id,
			review_id = EXCLUDED.review_id,
			author_github_account_id = EXCLUDED.author_github_account_id,
			path = EXCLUDED.path,
			position = EXCLUDED.position,
			body = EXCLUDED.body,
			created_at_source = EXCLUDED.created_at_source,
			payload_jsonb = EXCLUDED.payload_jsonb
	`,
		githubCommentID,
		pullRequestID,
		reviewID,
		authorAccountID,
		stringValue(comment["path"]),
		intValue(comment["position"]),
		stringValue(comment["body"]),
		parseGitHubTime(comment["created_at"]),
		encodeJSON(comment),
	)
	return err == nil, err
}

func (s *TxStore) UpsertIssue(payload map[string]any, repositoryID string, now time.Time) (bool, int, error) {
	issue := object(payload["issue"])
	if issue == nil || strings.TrimSpace(repositoryID) == "" {
		return false, 0, nil
	}
	githubIssueID := int64Value(issue["id"])
	if githubIssueID == 0 {
		return false, 0, nil
	}
	authorAccountID, err := s.lookupAccountIDByGitHubIdentity(object(issue["user"]))
	if err != nil {
		return false, 0, err
	}
	var issueID string
	err = s.tx.QueryRow(s.context(), `
		INSERT INTO repository_issues (
			github_issue_id,
			repository_id,
			author_github_account_id,
			number,
			title,
			state,
			locked,
			created_at_source,
			updated_at_source,
			closed_at_source,
			payload_jsonb,
			synced_at
		) VALUES (
			$1,
			$2::uuid,
			NULLIF($3, '')::uuid,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			$10,
			$11::jsonb,
			$12
		)
		ON CONFLICT (github_issue_id) DO UPDATE SET
			repository_id = EXCLUDED.repository_id,
			author_github_account_id = EXCLUDED.author_github_account_id,
			number = EXCLUDED.number,
			title = EXCLUDED.title,
			state = EXCLUDED.state,
			locked = EXCLUDED.locked,
			created_at_source = EXCLUDED.created_at_source,
			updated_at_source = EXCLUDED.updated_at_source,
			closed_at_source = EXCLUDED.closed_at_source,
			payload_jsonb = EXCLUDED.payload_jsonb,
			synced_at = EXCLUDED.synced_at
		RETURNING id::text
	`,
		githubIssueID,
		repositoryID,
		authorAccountID,
		intValue(issue["number"]),
		stringValue(issue["title"]),
		stringValue(issue["state"]),
		boolValue(issue["locked"]),
		coalesceTime(parseGitHubTime(issue["created_at"]), now.UTC()),
		coalesceTime(parseGitHubTime(issue["updated_at"]), now.UTC()),
		parseGitHubTime(issue["closed_at"]),
		encodeJSON(issue),
		now.UTC(),
	).Scan(&issueID)
	if err != nil {
		return false, 0, err
	}
	labelCount, err := s.syncIssueLabels(issueID, repositoryID, objectArray(issue["labels"]), now.UTC())
	if err != nil {
		return false, 0, err
	}
	return true, labelCount, nil
}

func (s *TxStore) UpsertTopLevelLabel(payload map[string]any, repositoryID string, now time.Time) (bool, error) {
	if strings.TrimSpace(repositoryID) == "" {
		return false, nil
	}
	_, touched, err := s.upsertLabelObject(repositoryID, object(payload["label"]), now.UTC())
	return touched, err
}

func (s *TxStore) UpsertCommits(payload map[string]any, repositoryID string, now time.Time) (int, error) {
	if strings.TrimSpace(repositoryID) == "" {
		return 0, nil
	}

	commits := objectArray(payload["commits"])
	if len(commits) == 0 {
		if sha := strings.TrimSpace(stringValue(payload["after"])); sha != "" && sha != strings.Repeat("0", len(sha)) {
			commits = append(commits, map[string]any{"id": sha, "timestamp": now.UTC().Format(time.RFC3339)})
		} else if checkRun := object(payload["check_run"]); checkRun != nil {
			if headSHA := strings.TrimSpace(stringValue(checkRun["head_sha"])); headSHA != "" {
				commits = append(commits, map[string]any{"id": headSHA, "timestamp": now.UTC().Format(time.RFC3339)})
			}
		}
	}

	count := 0
	for _, commit := range commits {
		sha := strings.TrimSpace(stringValue(commit["id"]))
		if sha == "" {
			continue
		}
		authoredAt := parseGitHubTime(commit["timestamp"])
		_, err := s.tx.Exec(s.context(), `
			INSERT INTO repository_commits (
				repository_id,
				sha,
				authored_at_source,
				committed_at_source,
				message,
				verified,
				additions,
				deletions,
				changed_files,
				payload_jsonb,
				synced_at
			) VALUES (
				$1::uuid, $2, $3, $3, $4, FALSE, 0, 0, 0, $5::jsonb, $6
			)
			ON CONFLICT (repository_id, sha) DO UPDATE SET
				authored_at_source = COALESCE(EXCLUDED.authored_at_source, repository_commits.authored_at_source),
				committed_at_source = COALESCE(EXCLUDED.committed_at_source, repository_commits.committed_at_source),
				message = EXCLUDED.message,
				payload_jsonb = EXCLUDED.payload_jsonb,
				synced_at = EXCLUDED.synced_at
		`, repositoryID, sha, authoredAt, stringValue(commit["message"]), encodeJSON(commit), now.UTC())
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func (s *TxStore) InsertSyncRun(input payloadSyncRunInput) error {
	metricsJSON := encodeJSON(composeSyncRunMetrics(input.Result.EntityCounts(), input.Fetched))
	status := defaultString(strings.TrimSpace(input.Status), "completed")
	subject := canonicalSyncRunSubject(input.EventType, input.Subject)
	eventType := strings.TrimSpace(input.EventType)
	correlationID := strings.TrimSpace(input.CorrelationID)

	if shouldFinalizeExistingSyncRun(status, input.FinishedAt) {
		updated, err := s.finalizeExistingSyncRun(payloadSyncRunInput{
			CorrelationID:               correlationID,
			EventType:                   eventType,
			Status:                      status,
			LastError:                   input.LastError,
			Subject:                     subject,
			InstallationID:              input.InstallationID,
			RepositoryID:                input.RepositoryID,
			DeliveryID:                  input.DeliveryID,
			RequestedUserLogin:          input.RequestedUserLogin,
			RequestedRepositoryFullName: input.RequestedRepositoryFullName,
			RequestedBySubject:          input.RequestedBySubject,
			RequestedByGitHubLogin:      input.RequestedByGitHubLogin,
			FinishedAt:                  input.FinishedAt,
		}, metricsJSON)
		if err != nil {
			return err
		}
		if updated {
			return nil
		}
	}

	_, err := s.tx.Exec(s.context(), `
		INSERT INTO github_sync_runs (
			run_type,
			status,
			subject,
			installation_id,
			repository_id,
			github_delivery_id,
			requested_user_login,
			requested_repository_full_name,
			requested_by_subject,
			requested_by_github_login,
			correlation_id,
			started_at,
			finished_at,
			last_error,
			metrics_jsonb
		) VALUES (
			$1,
			$2,
			$3,
			NULLIF($4, '')::uuid,
			NULLIF($5, '')::uuid,
			$6,
			$7,
			$8,
			$9,
			$10,
			$11,
			$12,
			$13,
			$14,
			$15::jsonb
		)
	`,
		eventType,
		status,
		subject,
		input.InstallationID,
		input.RepositoryID,
		input.DeliveryID,
		strings.TrimSpace(input.RequestedUserLogin),
		strings.TrimSpace(input.RequestedRepositoryFullName),
		strings.TrimSpace(input.RequestedBySubject),
		strings.TrimSpace(input.RequestedByGitHubLogin),
		input.CorrelationID,
		input.StartedAt.UTC(),
		nullableTime(input.FinishedAt),
		strings.TrimSpace(input.LastError),
		metricsJSON,
	)
	return err
}

func (s *TxStore) finalizeExistingSyncRun(input payloadSyncRunInput, metricsJSON string) (bool, error) {
	if strings.TrimSpace(input.CorrelationID) == "" || strings.TrimSpace(input.EventType) == "" || strings.TrimSpace(input.Subject) == "" {
		return false, nil
	}

	finishedAt := nullableTime(input.FinishedAt)
	subject := canonicalSyncRunSubject(input.EventType, input.Subject)
	var updatedID string
	err := s.tx.QueryRow(s.context(), `
		WITH candidate AS (
			SELECT id
			FROM github_sync_runs
			WHERE
				correlation_id = $1
				AND run_type = $2
				AND (
					(lower($2) = 'user' AND lower(subject) = lower($3))
					OR (lower($2) <> 'user' AND subject = $3)
				)
				AND finished_at IS NULL
				AND lower(status) IN ('queued', 'pending', 'running', 'syncing', 'in_progress')
			ORDER BY started_at DESC
			LIMIT 1
		)
		UPDATE github_sync_runs AS runs
		SET
			status = $4,
			installation_id = COALESCE(NULLIF($5, '')::uuid, runs.installation_id),
			repository_id = COALESCE(NULLIF($6, '')::uuid, runs.repository_id),
			github_delivery_id = CASE WHEN btrim($7) = '' THEN runs.github_delivery_id ELSE $7 END,
			requested_user_login = CASE WHEN btrim($8) = '' THEN runs.requested_user_login ELSE $8 END,
			requested_repository_full_name = CASE WHEN btrim($9) = '' THEN runs.requested_repository_full_name ELSE $9 END,
			requested_by_subject = CASE WHEN btrim($10) = '' THEN runs.requested_by_subject ELSE $10 END,
			requested_by_github_login = CASE WHEN btrim($11) = '' THEN runs.requested_by_github_login ELSE $11 END,
			finished_at = COALESCE($12::timestamptz, runs.finished_at, NOW()),
			last_error = CASE
				WHEN btrim($13) <> '' THEN $13
				WHEN lower($4) = 'failed' AND btrim(runs.last_error) = '' THEN 'sync execution failed without explicit error details'
				ELSE runs.last_error
			END,
			metrics_jsonb = CASE
				WHEN $14::jsonb = '{}'::jsonb THEN runs.metrics_jsonb
				ELSE $14::jsonb
			END
		FROM candidate
		WHERE runs.id = candidate.id
		RETURNING runs.id
	`,
		strings.TrimSpace(input.CorrelationID),
		strings.TrimSpace(input.EventType),
		subject,
		defaultString(strings.TrimSpace(input.Status), "completed"),
		strings.TrimSpace(input.InstallationID),
		strings.TrimSpace(input.RepositoryID),
		strings.TrimSpace(input.DeliveryID),
		strings.TrimSpace(input.RequestedUserLogin),
		strings.TrimSpace(input.RequestedRepositoryFullName),
		strings.TrimSpace(input.RequestedBySubject),
		strings.TrimSpace(input.RequestedByGitHubLogin),
		finishedAt,
		strings.TrimSpace(input.LastError),
		metricsJSON,
	).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(updatedID) != "", nil
}

func shouldFinalizeExistingSyncRun(status string, finishedAt *time.Time) bool {
	if finishedAt == nil {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "queued", "pending", "running", "syncing", "in_progress":
		return false
	default:
		return true
	}
}

func canonicalSyncRunSubject(runType string, subject string) string {
	normalizedSubject := strings.TrimSpace(subject)
	if strings.EqualFold(strings.TrimSpace(runType), "user") {
		return strings.ToLower(normalizedSubject)
	}
	return normalizedSubject
}

func composeSyncRunMetrics(persisted map[string]int, fetched map[string]int) map[string]int {
	metrics := make(map[string]int, len(persisted)+(len(fetched)*2))

	for key, value := range persisted {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		metrics[key] = value
		metrics["persisted_"+key] = value
	}

	for key, value := range fetched {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		metrics["fetched_"+key] = value
		if _, exists := metrics[key]; !exists {
			metrics[key] = value
		}
	}

	return metrics
}

func (s *Store) MarkStaleSyncRunsFailed(
	ctx context.Context,
	now time.Time,
	activeCutoff time.Time,
	queuedCutoff time.Time,
) error {
	if s == nil || s.pool == nil {
		return ErrUnavailable
	}

	if _, err := s.pool.Exec(ctx, `
		UPDATE github_sync_runs
		SET
			status = 'failed',
			finished_at = COALESCE(finished_at, $1),
			last_error = CASE
				WHEN btrim(last_error) = '' THEN 'sync execution exceeded active window and was marked failed'
				ELSE last_error
			END
		WHERE
			finished_at IS NULL
			AND lower(status) IN ('running', 'syncing', 'in_progress')
			AND started_at <= $2
	`, now.UTC(), activeCutoff.UTC()); err != nil {
		return err
	}

	if _, err := s.pool.Exec(ctx, `
		UPDATE github_sync_runs
		SET
			status = 'failed',
			finished_at = COALESCE(finished_at, $1),
			last_error = CASE
				WHEN btrim(last_error) = '' THEN 'sync execution remained queued beyond safe window and was marked failed'
				ELSE last_error
			END
		WHERE
			finished_at IS NULL
			AND lower(status) IN ('queued', 'pending')
			AND started_at <= $2
	`, now.UTC(), queuedCutoff.UTC()); err != nil {
		return err
	}

	return nil
}

func (s *Store) MarkSyncRunRunning(
	ctx context.Context,
	correlationID string,
	runType string,
	subject string,
	startedAt time.Time,
) (bool, error) {
	if s == nil || s.pool == nil {
		return false, ErrUnavailable
	}

	correlationID = strings.TrimSpace(correlationID)
	runType = strings.TrimSpace(runType)
	subject = canonicalSyncRunSubject(runType, subject)
	if correlationID == "" || runType == "" || subject == "" {
		return false, nil
	}

	if startedAt.IsZero() {
		startedAt = time.Now().UTC()
	}
	startedAt = startedAt.UTC()

	var updatedID string
	err := s.pool.QueryRow(ctx, `
		WITH candidate AS (
			SELECT id
			FROM github_sync_runs
			WHERE
				correlation_id = $1
				AND run_type = $2
				AND (
					(lower($2) = 'user' AND lower(subject) = lower($3))
					OR (lower($2) <> 'user' AND subject = $3)
				)
				AND finished_at IS NULL
				AND lower(status) IN ('queued', 'pending')
			ORDER BY started_at DESC
			LIMIT 1
		)
		UPDATE github_sync_runs AS runs
		SET
			status = 'running',
			started_at = $4,
			last_error = CASE
				WHEN lower(runs.status) IN ('queued', 'pending') THEN ''
				ELSE runs.last_error
			END
		FROM candidate
		WHERE runs.id = candidate.id
		RETURNING runs.id
	`,
		correlationID,
		runType,
		subject,
		startedAt,
	).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(updatedID) != "", nil
}

func (s *Store) ListSyncRuns(ctx context.Context, filter contracts.GitHubSyncRunFilter) ([]contracts.GitHubSyncRunView, error) {
	if s == nil || s.pool == nil {
		return nil, ErrUnavailable
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 1
	}

	conditions := []string{"1=1"}
	args := make([]any, 0, 8)
	add := func(condition string, value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(condition, len(args)))
	}

	add("lower(runs.run_type) = $%d", filter.RunType)
	add("lower(runs.status) = $%d", filter.Status)
	add("lower(runs.subject) = lower($%d)", filter.Subject)
	add("lower(runs.requested_repository_full_name) = $%d", filter.Repository)
	add("lower(runs.requested_user_login) = $%d", filter.User)
	add("runs.requested_by_subject = $%d", filter.RequestedBySubject)
	add("lower(runs.requested_by_github_login) = $%d", filter.RequestedByGitHubLogin)
	add("runs.correlation_id = $%d", filter.CorrelationID)
	add("runs.github_delivery_id = $%d", filter.DeliveryID)

	args = append(args, limit)
	query := `
		SELECT
			runs.id::text,
			runs.run_type,
			runs.status,
			runs.subject,
			runs.requested_repository_full_name,
			runs.requested_user_login,
			runs.requested_by_subject,
			runs.requested_by_github_login,
			COALESCE(src.github_installation_id, 0),
			runs.github_delivery_id,
			runs.correlation_id,
			runs.started_at,
			runs.finished_at,
			runs.last_error,
			runs.metrics_jsonb
		FROM github_sync_runs runs
		LEFT JOIN github_installations src ON src.id = runs.installation_id
		WHERE ` + strings.Join(conditions, " AND ") + `
		ORDER BY started_at DESC, id DESC
		LIMIT $` + fmt.Sprintf("%d", len(args))

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	runs := make([]contracts.GitHubSyncRunView, 0, limit)
	for rows.Next() {
		var run contracts.GitHubSyncRunView
		var metricsJSON []byte
		if err := rows.Scan(
			&run.ID,
			&run.RunType,
			&run.Status,
			&run.Subject,
			&run.RequestedRepository,
			&run.RequestedUser,
			&run.RequestedBySubject,
			&run.RequestedByGitHubLogin,
			&run.Installation,
			&run.DeliveryID,
			&run.CorrelationID,
			&run.StartedAt,
			&run.FinishedAt,
			&run.LastError,
			&metricsJSON,
		); err != nil {
			return nil, err
		}
		if len(metricsJSON) > 0 {
			if err := json.Unmarshal(metricsJSON, &run.Metrics); err != nil {
				return nil, err
			}
		}
		runs = append(runs, run)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return runs, nil
}

func (s *TxStore) syncPullRequestLabels(pullRequestID, repositoryID string, labels []map[string]any, now time.Time) (int, error) {
	count := 0
	for _, label := range labels {
		labelID, touched, err := s.upsertLabelObject(repositoryID, label, now.UTC())
		if err != nil {
			return count, err
		}
		if touched {
			count++
		}
		if strings.TrimSpace(labelID) == "" {
			continue
		}
		if _, err := s.tx.Exec(s.context(), `
			INSERT INTO pull_request_labels (pull_request_id, label_id)
			VALUES ($1::uuid, $2::uuid)
			ON CONFLICT DO NOTHING
		`, pullRequestID, labelID); err != nil {
			return count, err
		}
	}
	return count, nil
}

func (s *TxStore) syncIssueLabels(issueID, repositoryID string, labels []map[string]any, now time.Time) (int, error) {
	count := 0
	for _, label := range labels {
		labelID, touched, err := s.upsertLabelObject(repositoryID, label, now.UTC())
		if err != nil {
			return count, err
		}
		if touched {
			count++
		}
		if strings.TrimSpace(labelID) == "" {
			continue
		}
		if _, err := s.tx.Exec(s.context(), `
			INSERT INTO repository_issue_labels (issue_id, label_id)
			VALUES ($1::uuid, $2::uuid)
			ON CONFLICT DO NOTHING
		`, issueID, labelID); err != nil {
			return count, err
		}
	}
	return count, nil
}

func (s *TxStore) upsertLabelObject(repositoryID string, label map[string]any, now time.Time) (string, bool, error) {
	if label == nil || strings.TrimSpace(repositoryID) == "" {
		return "", false, nil
	}
	githubLabelID := int64Value(label["id"])
	if githubLabelID == 0 {
		return "", false, nil
	}
	var labelID string
	err := s.tx.QueryRow(s.context(), `
		INSERT INTO repository_labels (
			github_label_id,
			repository_id,
			name,
			color,
			description,
			is_default,
			updated_at_source,
			payload_jsonb
		) VALUES (
			$1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb
		)
		ON CONFLICT (github_label_id) DO UPDATE SET
			repository_id = EXCLUDED.repository_id,
			name = EXCLUDED.name,
			color = EXCLUDED.color,
			description = EXCLUDED.description,
			is_default = EXCLUDED.is_default,
			updated_at_source = EXCLUDED.updated_at_source,
			payload_jsonb = EXCLUDED.payload_jsonb
		RETURNING id::text
	`, githubLabelID, repositoryID, stringValue(label["name"]), stringValue(label["color"]), stringValue(label["description"]), boolValue(label["default"]), now.UTC(), encodeJSON(label)).Scan(&labelID)
	return labelID, err == nil, err
}

func (s *TxStore) syncInstallationRepositories(installationID string, payload map[string]any, now time.Time) error {
	if strings.TrimSpace(installationID) == "" {
		return nil
	}
	for _, repo := range objectArray(payload["repositories"]) {
		repositoryID, _, err := s.UpsertRepository(map[string]any{"repository": repo}, now.UTC())
		if err != nil {
			return err
		}
		if strings.TrimSpace(repositoryID) == "" {
			continue
		}
		if _, err := s.tx.Exec(s.context(), `
			INSERT INTO github_installation_repositories (
				installation_id,
				repository_id,
				permissions_jsonb,
				selected_at,
				removed_at
			) VALUES (
				$1::uuid, $2::uuid, '{}'::jsonb, $3, NULL
			)
			ON CONFLICT (installation_id, repository_id) DO UPDATE SET
				removed_at = NULL,
				selected_at = EXCLUDED.selected_at
		`, installationID, repositoryID, now.UTC()); err != nil {
			return err
		}
	}
	for _, repo := range objectArray(payload["repositories_added"]) {
		repositoryID, _, err := s.UpsertRepository(map[string]any{"repository": repo}, now.UTC())
		if err != nil {
			return err
		}
		if strings.TrimSpace(repositoryID) == "" {
			continue
		}
		if _, err := s.tx.Exec(s.context(), `
			INSERT INTO github_installation_repositories (
				installation_id,
				repository_id,
				permissions_jsonb,
				selected_at,
				removed_at
			) VALUES (
				$1::uuid, $2::uuid, '{}'::jsonb, $3, NULL
			)
			ON CONFLICT (installation_id, repository_id) DO UPDATE SET
				removed_at = NULL,
				selected_at = EXCLUDED.selected_at
		`, installationID, repositoryID, now.UTC()); err != nil {
			return err
		}
	}
	for _, repo := range objectArray(payload["repositories_removed"]) {
		repositoryID, _, err := s.UpsertRepository(map[string]any{"repository": repo}, now.UTC())
		if err != nil {
			return err
		}
		if strings.TrimSpace(repositoryID) == "" {
			continue
		}
		if _, err := s.tx.Exec(s.context(), `
			UPDATE github_installation_repositories
			SET removed_at = $3
			WHERE installation_id = $1::uuid
			  AND repository_id = $2::uuid
		`, installationID, repositoryID, now.UTC()); err != nil {
			return err
		}
	}
	return nil
}

func (s *TxStore) lookupAccountIDByGitHubUserID(githubUserID int64) (string, error) {
	if githubUserID == 0 {
		return "", nil
	}
	row := s.tx.QueryRow(s.context(), `
		SELECT id::text
		FROM github_accounts
		WHERE github_user_id = $1
		LIMIT 1
	`, githubUserID)
	var accountID string
	if err := row.Scan(&accountID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return accountID, nil
}

func (s *TxStore) lookupAccountIDByGitHubIdentity(identity map[string]any) (string, error) {
	accountID, err := s.lookupAccountIDByGitHubUserID(int64Value(identity["id"]))
	if err != nil || strings.TrimSpace(accountID) != "" {
		return accountID, err
	}
	return s.lookupAccountIDByGitHubLogin(stringValue(identity["login"]))
}

func (s *TxStore) lookupAccountIDByGitHubLogin(githubLogin string) (string, error) {
	githubLogin = strings.TrimSpace(githubLogin)
	if githubLogin == "" {
		return "", nil
	}
	row := s.tx.QueryRow(s.context(), `
		SELECT id::text
		FROM github_accounts
		WHERE LOWER(login) = LOWER($1)
		  AND COALESCE(link_status, 'linked') = 'linked'
		LIMIT 1
	`, githubLogin)
	var accountID string
	if err := row.Scan(&accountID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return accountID, nil
}

func (s *TxStore) lookupReviewIDByGitHubID(githubReviewID int64) (string, error) {
	if githubReviewID == 0 {
		return "", nil
	}
	row := s.tx.QueryRow(s.context(), `
		SELECT id::text
		FROM pull_request_reviews
		WHERE github_review_id = $1
		LIMIT 1
	`, githubReviewID)
	var reviewID string
	if err := row.Scan(&reviewID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return reviewID, nil
}

func object(value any) map[string]any {
	if cast, ok := value.(map[string]any); ok {
		return cast
	}
	return nil
}

func objectArray(value any) []map[string]any {
	if typed, ok := value.([]map[string]any); ok {
		return typed
	}
	raw, ok := value.([]any)
	if !ok {
		return nil
	}
	out := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		if cast, ok := item.(map[string]any); ok {
			out = append(out, cast)
		}
	}
	return out
}

func stringValue(value any) string {
	if cast, ok := value.(string); ok {
		return strings.TrimSpace(cast)
	}
	return ""
}

func boolValue(value any) bool {
	if cast, ok := value.(bool); ok {
		return cast
	}
	return false
}

func intValue(value any) int {
	switch cast := value.(type) {
	case int:
		return cast
	case int64:
		return int(cast)
	case float64:
		return int(cast)
	default:
		return 0
	}
}

func int64Value(value any) int64 {
	switch cast := value.(type) {
	case int:
		return int64(cast)
	case int64:
		return cast
	case float64:
		return int64(cast)
	default:
		return 0
	}
}

func encodeJSON(value any) string {
	if value == nil {
		return "{}"
	}
	if bytes, err := json.Marshal(value); err == nil {
		return string(bytes)
	}
	return "{}"
}

func textArray(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return []string{}
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if text := stringValue(item); text != "" {
			out = append(out, text)
		}
	}
	return out
}

func parseGitHubTime(value any) *time.Time {
	text := stringValue(value)
	if text == "" {
		return nil
	}
	if parsed, err := time.Parse(time.RFC3339, text); err == nil {
		utc := parsed.UTC()
		return &utc
	}
	return nil
}

func coalesceTime(value *time.Time, fallback time.Time) time.Time {
	if value != nil {
		return value.UTC()
	}
	return fallback.UTC()
}

func firstPositiveInt(values ...int) int {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func pullRequestFilePath(file map[string]any) string {
	path := strings.TrimSpace(stringValue(file["filename"]))
	if path == "" {
		path = strings.TrimSpace(stringValue(file["path"]))
	}
	return path
}

func pullRequestFilePatch(file map[string]any) string {
	return boundedStringBytes(rawStringValue(file["patch"]), maxStoredPullRequestFilePatchBytes)
}

func sanitizedPullRequestFilePayload(file map[string]any, patch string) map[string]any {
	sanitized := cloneJSONMap(file)
	if sanitized == nil {
		sanitized = map[string]any{}
	}
	sanitized["patch"] = patch
	delete(sanitized, "contents")
	delete(sanitized, "content")
	return sanitized
}

type patchLineStats struct {
	Hunks        int
	AddedLines   int
	RemovedLines int
	ContextLines int
}

func derivePullRequestFileFeatures(file map[string]any, path, rawPatch, storedPatch string) map[string]any {
	fileType := classifyPullRequestFilePath(path)
	stats := patchStats(storedPatch)
	additions := intValue(file["additions"])
	deletions := intValue(file["deletions"])
	changes := firstPositiveInt(intValue(file["changes"]), additions+deletions)

	return map[string]any{
		"path_extension":        pathExtension(path),
		"file_type":             fileType,
		"status":                stringValue(file["status"]),
		"additions":             additions,
		"deletions":             deletions,
		"changes":               changes,
		"has_patch":             storedPatch != "",
		"patch_hunks":           stats.Hunks,
		"patch_added_lines":     stats.AddedLines,
		"patch_removed_lines":   stats.RemovedLines,
		"patch_context_lines":   stats.ContextLines,
		"patch_truncated":       len(rawPatch) > len(storedPatch),
		"binary_or_large_patch": rawPatch == "" && changes > 0,
		"is_test":               fileType == "test",
		"is_docs":               fileType == "docs",
		"is_infra":              fileType == "infra",
		"is_config":             fileType == "config",
	}
}

func patchStats(patch string) patchLineStats {
	var stats patchLineStats
	for _, line := range strings.Split(patch, "\n") {
		switch {
		case strings.HasPrefix(line, "@@"):
			stats.Hunks++
		case strings.HasPrefix(line, "+++") || strings.HasPrefix(line, "---"):
			continue
		case strings.HasPrefix(line, "+"):
			stats.AddedLines++
		case strings.HasPrefix(line, "-"):
			stats.RemovedLines++
		case strings.HasPrefix(line, " "):
			stats.ContextLines++
		}
	}
	return stats
}

func classifyPullRequestFilePath(path string) string {
	normalized := strings.ToLower(strings.TrimSpace(path))
	extension := pathExtension(normalized)
	switch {
	case normalized == "":
		return "unknown"
	case strings.Contains(normalized, "/test/") ||
		strings.Contains(normalized, "/tests/") ||
		strings.Contains(normalized, "/__tests__/") ||
		strings.HasPrefix(normalized, "test/") ||
		strings.HasPrefix(normalized, "tests/") ||
		strings.Contains(normalized, "_test.") ||
		strings.Contains(normalized, ".test.") ||
		strings.Contains(normalized, ".spec."):
		return "test"
	case strings.HasPrefix(normalized, "docs/") ||
		strings.Contains(normalized, "/docs/") ||
		strings.Contains(normalized, "/documentation/") ||
		extension == ".md" ||
		extension == ".mdx" ||
		extension == ".rst":
		return "docs"
	case strings.HasPrefix(normalized, ".github/") ||
		strings.HasPrefix(normalized, "deployments/") ||
		strings.HasPrefix(normalized, "k8s/") ||
		strings.HasPrefix(normalized, "helm/") ||
		strings.Contains(normalized, "/terraform/") ||
		extension == ".tf" ||
		extension == ".yaml" ||
		extension == ".yml" ||
		extension == ".dockerfile":
		return "infra"
	case strings.HasPrefix(normalized, "config/") ||
		strings.HasSuffix(normalized, ".json") ||
		strings.HasSuffix(normalized, ".toml") ||
		strings.HasSuffix(normalized, ".ini") ||
		strings.HasSuffix(normalized, ".env.example"):
		return "config"
	default:
		return "source"
	}
}

func pathExtension(path string) string {
	trimmed := strings.TrimSpace(path)
	slash := strings.LastIndex(trimmed, "/")
	dot := strings.LastIndex(trimmed, ".")
	if dot <= slash || dot == len(trimmed)-1 {
		return ""
	}
	return strings.ToLower(trimmed[dot:])
}

func rawStringValue(value any) string {
	if cast, ok := value.(string); ok {
		return cast
	}
	return ""
}

func boundedStringBytes(value string, limit int) string {
	if limit <= 0 || len(value) <= limit {
		return value
	}

	end := 0
	for index := range value {
		if index > limit {
			break
		}
		end = index
	}
	return value[:end]
}

func (s *TxStore) context() context.Context {
	if s != nil && s.ctx != nil {
		return s.ctx
	}
	return context.Background()
}

func (s *TxStore) lookupRepositoryIDByFullName(fullName string) (string, error) {
	fullName = strings.TrimSpace(fullName)
	if fullName == "" {
		return "", nil
	}
	row := s.tx.QueryRow(s.context(), `
		SELECT id::text
		FROM repositories
		WHERE full_name = $1
		LIMIT 1
	`, fullName)
	var repositoryID string
	if err := row.Scan(&repositoryID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return repositoryID, nil
}

func (s *TxStore) lookupInstallationIDByGitHubID(githubInstallationID int64) (string, error) {
	if githubInstallationID <= 0 {
		return "", nil
	}
	row := s.tx.QueryRow(s.context(), `
		SELECT id::text
		FROM github_installations
		WHERE github_installation_id = $1
		LIMIT 1
	`, githubInstallationID)
	var installationID string
	if err := row.Scan(&installationID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return installationID, nil
}

func nullableTime(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	utc := value.UTC()
	return &utc
}
