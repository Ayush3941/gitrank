package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/authkit"
	"github.com/Ayush3941/gitrank/packages/githubapi"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound        = errors.New("not found")
	ErrConflict        = errors.New("conflict")
	ErrStateNotUsable  = errors.New("oauth state is missing, expired, or already used")
	ErrSessionNotFound = errors.New("session not found")
	ErrInvalidCSRF     = errors.New("invalid CSRF token")
)

type Store struct {
	pool *pgxpool.Pool
}

type OAuthStateRecord struct {
	Nonce         string
	Intent        string
	ClientMode    string
	ReturnTo      string
	LinkingUserID string
	ExpiresAt     time.Time
}

type SessionView struct {
	SessionID                 string
	UserID                    string
	DisplayName               string
	AvatarURL                 string
	PublicHandle              string
	GitHubAccountID           string
	GitHubUserID              int64
	GitHubLogin               string
	GitHubDisplayName         string
	GitHubEmail               string
	GitHubAvatarURL           string
	GitHubUserType            string
	GitHubAccessMode          string
	GitHubScope               string
	GitHubLinkedAt            time.Time
	GitHubUnlinkedAt          *time.Time
	GitHubAuthorizationStatus string
	Roles                     []string
	SessionCreatedAt          time.Time
	SessionLastSeenAt         time.Time
	SessionLastRefreshedAt    time.Time
	SessionRotatedAt          time.Time
	SessionExpiresAt          time.Time
	SessionIdleExpiresAt      time.Time
}

type GitHubTokenRecord struct {
	GitHubAccountID       string
	AccessTokenEncrypted  string
	RefreshTokenEncrypted string
	TokenType             string
	Scope                 string
	ExpiresAt             *time.Time
	RefreshTokenExpiresAt *time.Time
	RevokedAt             *time.Time
	RevokedReason         string
	LastRefreshError      string
}

type CompleteAuthInput struct {
	Intent            string
	LinkingUserID     string
	GitHubUser        githubapi.CurrentUser
	Email             string
	ClientMode        string
	OAuthScope        string
	AccessToken       string
	RefreshToken      string
	TokenType         string
	AccessExpiresAt   *time.Time
	RefreshExpiresAt  *time.Time
	SessionTokenHash  string
	CSRFTokenHash     string
	Roles             []string
	RequestIP         string
	UserAgent         string
	SessionExpiresAt  time.Time
	SessionIdleExpiry time.Time
	RotatedAt         time.Time
	UsedStateNonce    string
	PriorSessionID    string
	Now               time.Time
}

type RotateSessionInput struct {
	SessionID                 string
	GitHubAccountID           string
	SessionTokenHash          string
	CSRFTokenHash             string
	GitHubAuthorizationStatus string
	Roles                     []string
	RotatedAt                 time.Time
	ExpiresAt                 time.Time
	IdleExpiresAt             time.Time
	RefreshAbsoluteExpiry     bool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func (s *Store) CreateOAuthState(ctx context.Context, nonce, browserTokenHash, intent, clientMode, returnTo, linkingUserID, requestIP, userAgent string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO auth_oauth_states (
			state_nonce,
			browser_token_hash,
			intent,
			client_mode,
			request_ip,
			user_agent,
			return_to,
			linking_user_id,
			expires_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,NULLIF($8, ''),$9)
	`, nonce, browserTokenHash, intent, clientMode, requestIP, userAgent, returnTo, linkingUserID, expiresAt.UTC())
	return err
}

func (s *Store) ConsumeOAuthState(ctx context.Context, nonce, browserTokenHash string, now time.Time) (OAuthStateRecord, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE auth_oauth_states
		SET used_at = $3
		WHERE state_nonce = $1
		  AND browser_token_hash = $2
		  AND used_at IS NULL
		  AND expires_at > $3
		RETURNING state_nonce, intent, client_mode, return_to, COALESCE(linking_user_id::text, ''), expires_at
	`, nonce, browserTokenHash, now.UTC())

	var record OAuthStateRecord
	if err := row.Scan(&record.Nonce, &record.Intent, &record.ClientMode, &record.ReturnTo, &record.LinkingUserID, &record.ExpiresAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return OAuthStateRecord{}, ErrStateNotUsable
		}
		return OAuthStateRecord{}, err
	}
	return record, nil
}

func (s *Store) LoadSessionByTokenHash(ctx context.Context, tokenHash string, now time.Time) (SessionView, error) {
	return loadSession(ctx, s.pool, `
		SELECT
			s.id,
			s.user_id::text,
			u.display_name,
			u.avatar_url,
			COALESCE(u.public_handle, ''),
			s.github_account_id::text,
			ga.github_user_id,
			ga.login,
			ga.display_name,
			ga.email,
			ga.avatar_url,
			ga.user_type,
			ga.access_mode,
			COALESCE(gut.scope, ''),
			ga.linked_at,
			COALESCE(ga.unlinked_at, TIMESTAMPTZ 'epoch'),
			ga.unlinked_at IS NOT NULL,
			s.github_authorization_status,
			s.roles,
			s.created_at,
			s.last_seen_at,
			s.last_refreshed_at,
			s.rotated_at,
			s.expires_at,
			s.idle_expires_at
		FROM auth_sessions s
		JOIN users u ON u.id = s.user_id
		JOIN github_accounts ga ON ga.id = s.github_account_id
		LEFT JOIN github_user_tokens gut ON gut.github_account_id = ga.id
		WHERE s.session_token_hash = $1
		  AND s.invalidated_at IS NULL
		  AND s.expires_at > $2
		  AND s.idle_expires_at > $2
		  AND ga.link_status = 'linked'
	`, tokenHash, now.UTC())
}

func (s *Store) TouchSession(ctx context.Context, sessionID string, lastSeenAt, idleExpiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE auth_sessions
		SET last_seen_at = $2,
			idle_expires_at = $3
		WHERE id = $1
		  AND invalidated_at IS NULL
	`, sessionID, lastSeenAt.UTC(), idleExpiresAt.UTC())
	return err
}

func (s *Store) RotateSession(ctx context.Context, input RotateSessionInput) (SessionView, error) {
	_, err := s.pool.Exec(ctx, `
		UPDATE auth_sessions
		SET github_account_id = $2,
			session_token_hash = $3,
			csrf_token_hash = $4,
			github_authorization_status = $5,
			roles = $6,
			last_seen_at = $7,
			last_refreshed_at = CASE WHEN $10 THEN $7 ELSE last_refreshed_at END,
			rotated_at = $7,
			expires_at = CASE WHEN $10 THEN $8 ELSE expires_at END,
			idle_expires_at = $9
		WHERE id = $1
		  AND invalidated_at IS NULL
	`, input.SessionID, input.GitHubAccountID, input.SessionTokenHash, input.CSRFTokenHash, input.GitHubAuthorizationStatus, input.Roles, input.RotatedAt.UTC(), input.ExpiresAt.UTC(), input.IdleExpiresAt.UTC(), input.RefreshAbsoluteExpiry)
	if err != nil {
		return SessionView{}, err
	}
	return loadSession(ctx, s.pool, sessionByIDQuery, input.SessionID)
}

func (s *Store) UpdateSessionAuthorizationStatus(ctx context.Context, sessionID, status string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE auth_sessions
		SET github_authorization_status = $2
		WHERE id = $1
	`, sessionID, status)
	return err
}

func (s *Store) InvalidateSession(ctx context.Context, sessionID, reason string, now time.Time) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE auth_sessions
		SET invalidated_at = $2,
			invalidated_reason = $3
		WHERE id = $1
		  AND invalidated_at IS NULL
	`, sessionID, now.UTC(), reason)
	return err
}

func (s *Store) InvalidateSessionsForAccount(ctx context.Context, githubAccountID, reason string, now time.Time) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE auth_sessions
		SET invalidated_at = $3,
			invalidated_reason = $2
		WHERE github_account_id = $1
		  AND invalidated_at IS NULL
	`, githubAccountID, reason, now.UTC())
	return err
}

func (s *Store) LoadGitHubToken(ctx context.Context, githubAccountID string) (GitHubTokenRecord, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			github_account_id::text,
			access_token_encrypted,
			refresh_token_encrypted,
			token_type,
			scope,
			COALESCE(expires_at, TIMESTAMPTZ 'epoch'),
			expires_at IS NOT NULL,
			COALESCE(refresh_token_expires_at, TIMESTAMPTZ 'epoch'),
			refresh_token_expires_at IS NOT NULL,
			COALESCE(revoked_at, TIMESTAMPTZ 'epoch'),
			revoked_at IS NOT NULL,
			revoked_reason,
			last_refresh_error
		FROM github_user_tokens
		WHERE github_account_id = $1
	`, githubAccountID)

	var record GitHubTokenRecord
	var expiresAt, refreshExpiresAt, revokedAt time.Time
	var expiresSet, refreshSet, revokedSet bool
	if err := row.Scan(
		&record.GitHubAccountID,
		&record.AccessTokenEncrypted,
		&record.RefreshTokenEncrypted,
		&record.TokenType,
		&record.Scope,
		&expiresAt,
		&expiresSet,
		&refreshExpiresAt,
		&refreshSet,
		&revokedAt,
		&revokedSet,
		&record.RevokedReason,
		&record.LastRefreshError,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return GitHubTokenRecord{}, ErrNotFound
		}
		return GitHubTokenRecord{}, err
	}

	record.ExpiresAt = optionalTime(expiresSet, expiresAt)
	record.RefreshTokenExpiresAt = optionalTime(refreshSet, refreshExpiresAt)
	record.RevokedAt = optionalTime(revokedSet, revokedAt)
	return record, nil
}

func (s *Store) StoreRefreshedGitHubToken(ctx context.Context, githubAccountID string, token githubapi.UserAccessToken, accessTokenEncrypted, refreshTokenEncrypted string, accessExpiresAt, refreshExpiresAt *time.Time, now time.Time) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE github_user_tokens
		SET access_token_encrypted = $2,
			refresh_token_encrypted = $3,
			token_type = $4,
			scope = $5,
			expires_at = $6,
			refresh_token_expires_at = $7,
			last_used_at = $8,
			last_refreshed_at = $8,
			last_refresh_error = '',
			revoked_at = NULL,
			revoked_reason = ''
		WHERE github_account_id = $1
	`, githubAccountID, accessTokenEncrypted, refreshTokenEncrypted, token.TokenType, token.Scope, accessExpiresAt, refreshExpiresAt, now.UTC())
	return err
}

func (s *Store) MarkTokenRevoked(ctx context.Context, githubAccountID, reason string, now time.Time) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE github_user_tokens
		SET revoked_at = $2,
			revoked_reason = $3,
			last_refresh_error = CASE WHEN $3 = '' THEN last_refresh_error ELSE $3 END
		WHERE github_account_id = $1
	`, githubAccountID, now.UTC(), reason)
	return err
}

func (s *Store) CompleteAuth(ctx context.Context, input CompleteAuthInput) (SessionView, error) {
	var session SessionView
	err := withTx(ctx, s.pool, func(tx pgx.Tx) error {
		account, err := loadAccountByGitHubUserID(ctx, tx, input.GitHubUser.ID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return err
		}

		switch input.Intent {
		case "link":
			session, err = completeLinkTx(ctx, tx, input, account)
		default:
			session, err = completeLoginTx(ctx, tx, input, account)
		}
		return err
	})
	return session, err
}

func (s *Store) UnlinkAccount(ctx context.Context, userID, githubAccountID string, now time.Time) error {
	return withTx(ctx, s.pool, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			SELECT id::text
			FROM github_accounts
			WHERE id = $1
			  AND user_id = $2::uuid
			  AND link_status = 'linked'
		`, githubAccountID, userID)

		var accountID string
		if err := row.Scan(&accountID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}

		if _, err := tx.Exec(ctx, `
			UPDATE github_accounts
			SET link_status = 'unlinked',
				unlinked_at = $2,
				updated_at = $2
			WHERE id = $1
		`, accountID, now.UTC()); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE github_user_tokens
			SET revoked_at = $2,
				revoked_reason = 'user_unlinked'
			WHERE github_account_id = $1
		`, accountID, now.UTC()); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE auth_sessions
			SET invalidated_at = $2,
				invalidated_reason = 'account_unlinked'
			WHERE github_account_id = $1
			  AND invalidated_at IS NULL
		`, accountID, now.UTC()); err != nil {
			return err
		}
		return insertAudit(ctx, tx, "user", userID, "auth.account_unlinked", "github_account", accountID, map[string]any{
			"reason": "user_unlinked",
		})
	})
}

func (s *Store) DeleteAccount(ctx context.Context, userID, githubAccountID string, now time.Time) error {
	return withTx(ctx, s.pool, func(tx pgx.Tx) error {
		row := tx.QueryRow(ctx, `
			SELECT id::text, login
			FROM github_accounts
			WHERE id = $1
			  AND user_id = $2::uuid
			  AND link_status = 'linked'
		`, githubAccountID, userID)

		var accountID string
		var githubLogin string
		if err := row.Scan(&accountID, &githubLogin); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}

		if err := insertAudit(ctx, tx, "user", userID, "auth.account_deleted", "user", userID, map[string]any{
			"github_account_id": accountID,
			"github_login":      githubLogin,
			"mode":              "hard_delete_v1",
		}); err != nil {
			return err
		}

		_, err := tx.Exec(ctx, `
			DELETE FROM users
			WHERE id = $1::uuid
		`, userID)
		return err
	})
}

func (s *Store) Audit(ctx context.Context, actorType, actorID, action, targetType, targetID string, metadata map[string]any) error {
	return insertAudit(ctx, s.pool, actorType, actorID, action, targetType, targetID, metadata)
}

func completeLoginTx(ctx context.Context, tx pgx.Tx, input CompleteAuthInput, existing accountRecord) (SessionView, error) {
	now := input.Now.UTC()
	account := existing

	if account.ID == "" {
		userID, err := insertUser(ctx, tx, input.GitHubUser)
		if err != nil {
			return SessionView{}, err
		}
		accountID, err := insertGitHubAccount(ctx, tx, userID, input.GitHubUser, input.Email, input.ClientMode, input.OAuthScope, now)
		if err != nil {
			return SessionView{}, err
		}
		account, err = loadAccountByID(ctx, tx, accountID)
		if err != nil {
			return SessionView{}, err
		}
	} else {
		if account.LinkStatus == "unlinked" {
			if conflict, err := userHasDifferentLinkedAccount(ctx, tx, account.UserID, account.ID); err != nil {
				return SessionView{}, err
			} else if conflict {
				return SessionView{}, ErrConflict
			}
		}
		if err := updateUserFromGitHub(ctx, tx, account.UserID, input.GitHubUser); err != nil {
			return SessionView{}, err
		}
		if err := updateGitHubAccount(ctx, tx, account.ID, input.GitHubUser, input.Email, input.ClientMode, input.OAuthScope, now, true); err != nil {
			return SessionView{}, err
		}
		account, _ = loadAccountByID(ctx, tx, account.ID)
	}

	if err := upsertGitHubToken(ctx, tx, account.ID, input, now); err != nil {
		return SessionView{}, err
	}
	if strings.TrimSpace(input.PriorSessionID) != "" {
		if _, err := tx.Exec(ctx, `
			UPDATE auth_sessions
			SET invalidated_at = $2,
				invalidated_reason = 'session_replaced_by_login'
			WHERE id = $1
			  AND invalidated_at IS NULL
		`, input.PriorSessionID, now); err != nil {
			return SessionView{}, err
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE auth_oauth_states
		SET used_by_github_account_id = $2
		WHERE state_nonce = $1
	`, input.UsedStateNonce, account.ID); err != nil {
		return SessionView{}, err
	}

	sessionID, err := insertSession(ctx, tx, account.UserID, account.ID, input)
	if err != nil {
		return SessionView{}, err
	}
	if err := insertAudit(ctx, tx, "user", account.UserID, "auth.login.success", "github_account", account.ID, map[string]any{
		"client_mode":  input.ClientMode,
		"github_login": input.GitHubUser.Login,
	}); err != nil {
		return SessionView{}, err
	}
	return loadSession(ctx, tx, sessionByIDQuery, sessionID)
}

func completeLinkTx(ctx context.Context, tx pgx.Tx, input CompleteAuthInput, existing accountRecord) (SessionView, error) {
	now := input.Now.UTC()
	if strings.TrimSpace(input.LinkingUserID) == "" {
		return SessionView{}, ErrConflict
	}

	current, err := loadLinkedAccountByUserID(ctx, tx, input.LinkingUserID)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return SessionView{}, err
	}
	account := existing
	if account.ID != "" && account.UserID != input.LinkingUserID {
		return SessionView{}, ErrConflict
	}
	if current.ID != "" && current.ID != account.ID {
		return SessionView{}, ErrConflict
	}

	if account.ID == "" {
		accountID, err := insertGitHubAccount(ctx, tx, input.LinkingUserID, input.GitHubUser, input.Email, input.ClientMode, input.OAuthScope, now)
		if err != nil {
			return SessionView{}, err
		}
		account, err = loadAccountByID(ctx, tx, accountID)
		if err != nil {
			return SessionView{}, err
		}
	} else {
		if err := updateUserFromGitHub(ctx, tx, account.UserID, input.GitHubUser); err != nil {
			return SessionView{}, err
		}
		if err := updateGitHubAccount(ctx, tx, account.ID, input.GitHubUser, input.Email, input.ClientMode, input.OAuthScope, now, true); err != nil {
			return SessionView{}, err
		}
		account, _ = loadAccountByID(ctx, tx, account.ID)
	}

	if err := upsertGitHubToken(ctx, tx, account.ID, input, now); err != nil {
		return SessionView{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE auth_oauth_states
		SET used_by_github_account_id = $2
		WHERE state_nonce = $1
	`, input.UsedStateNonce, account.ID); err != nil {
		return SessionView{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE auth_sessions
		SET github_account_id = $2,
			session_token_hash = $3,
			csrf_token_hash = $4,
			github_authorization_status = 'active',
			roles = $5,
			last_seen_at = $6,
			last_refreshed_at = $6,
			rotated_at = $6,
			idle_expires_at = $7,
			expires_at = $8
		WHERE id = $1
		  AND invalidated_at IS NULL
	`, input.PriorSessionID, account.ID, input.SessionTokenHash, input.CSRFTokenHash, input.Roles, now, input.SessionIdleExpiry.UTC(), input.SessionExpiresAt.UTC()); err != nil {
		return SessionView{}, err
	}
	if err := insertAudit(ctx, tx, "user", input.LinkingUserID, "auth.account_linked", "github_account", account.ID, map[string]any{
		"client_mode":  input.ClientMode,
		"github_login": input.GitHubUser.Login,
	}); err != nil {
		return SessionView{}, err
	}
	return loadSession(ctx, tx, sessionByIDQuery, input.PriorSessionID)
}

func withTx(ctx context.Context, pool *pgxpool.Pool, fn func(pgx.Tx) error) error {
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

const sessionByIDQuery = `
	SELECT
		s.id,
		s.user_id::text,
		u.display_name,
		u.avatar_url,
		COALESCE(u.public_handle, ''),
		s.github_account_id::text,
		ga.github_user_id,
		ga.login,
		ga.display_name,
		ga.email,
		ga.avatar_url,
		ga.user_type,
		ga.access_mode,
		COALESCE(gut.scope, ''),
		ga.linked_at,
		COALESCE(ga.unlinked_at, TIMESTAMPTZ 'epoch'),
		ga.unlinked_at IS NOT NULL,
		s.github_authorization_status,
		s.roles,
		s.created_at,
		s.last_seen_at,
		s.last_refreshed_at,
		s.rotated_at,
		s.expires_at,
		s.idle_expires_at
	FROM auth_sessions s
	JOIN users u ON u.id = s.user_id
	JOIN github_accounts ga ON ga.id = s.github_account_id
	LEFT JOIN github_user_tokens gut ON gut.github_account_id = ga.id
	WHERE s.id = $1
`

func loadSession(ctx context.Context, q queryer, query string, arg any, extraArgs ...any) (SessionView, error) {
	args := append([]any{arg}, extraArgs...)
	row := q.QueryRow(ctx, query, args...)

	var session SessionView
	var unlinkedAt time.Time
	var hasUnlinkedAt bool
	if err := row.Scan(
		&session.SessionID,
		&session.UserID,
		&session.DisplayName,
		&session.AvatarURL,
		&session.PublicHandle,
		&session.GitHubAccountID,
		&session.GitHubUserID,
		&session.GitHubLogin,
		&session.GitHubDisplayName,
		&session.GitHubEmail,
		&session.GitHubAvatarURL,
		&session.GitHubUserType,
		&session.GitHubAccessMode,
		&session.GitHubScope,
		&session.GitHubLinkedAt,
		&unlinkedAt,
		&hasUnlinkedAt,
		&session.GitHubAuthorizationStatus,
		&session.Roles,
		&session.SessionCreatedAt,
		&session.SessionLastSeenAt,
		&session.SessionLastRefreshedAt,
		&session.SessionRotatedAt,
		&session.SessionExpiresAt,
		&session.SessionIdleExpiresAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SessionView{}, ErrSessionNotFound
		}
		return SessionView{}, err
	}
	session.GitHubUnlinkedAt = optionalTime(hasUnlinkedAt, unlinkedAt)
	return session, nil
}

type accountRecord struct {
	ID         string
	UserID     string
	LinkStatus string
}

func loadAccountByGitHubUserID(ctx context.Context, tx pgx.Tx, githubUserID int64) (accountRecord, error) {
	row := tx.QueryRow(ctx, `
		SELECT id::text, user_id::text, link_status
		FROM github_accounts
		WHERE github_user_id = $1
	`, githubUserID)
	var account accountRecord
	if err := row.Scan(&account.ID, &account.UserID, &account.LinkStatus); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return accountRecord{}, ErrNotFound
		}
		return accountRecord{}, err
	}
	return account, nil
}

func loadAccountByID(ctx context.Context, tx pgx.Tx, accountID string) (accountRecord, error) {
	row := tx.QueryRow(ctx, `
		SELECT id::text, user_id::text, link_status
		FROM github_accounts
		WHERE id = $1
	`, accountID)
	var account accountRecord
	if err := row.Scan(&account.ID, &account.UserID, &account.LinkStatus); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return accountRecord{}, ErrNotFound
		}
		return accountRecord{}, err
	}
	return account, nil
}

func loadLinkedAccountByUserID(ctx context.Context, tx pgx.Tx, userID string) (accountRecord, error) {
	row := tx.QueryRow(ctx, `
		SELECT id::text, user_id::text, link_status
		FROM github_accounts
		WHERE user_id = $1::uuid
		  AND link_status = 'linked'
	`, userID)
	var account accountRecord
	if err := row.Scan(&account.ID, &account.UserID, &account.LinkStatus); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return accountRecord{}, ErrNotFound
		}
		return accountRecord{}, err
	}
	return account, nil
}

func userHasDifferentLinkedAccount(ctx context.Context, tx pgx.Tx, userID, accountID string) (bool, error) {
	row := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM github_accounts
			WHERE user_id = $1::uuid
			  AND link_status = 'linked'
			  AND id <> $2::uuid
		)
	`, userID, accountID)
	var exists bool
	if err := row.Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func insertUser(ctx context.Context, tx pgx.Tx, user githubapi.CurrentUser) (string, error) {
	displayName := strings.TrimSpace(user.Name)
	if displayName == "" {
		displayName = user.Login
	}
	var userID string
	err := tx.QueryRow(ctx, `
		INSERT INTO users (display_name, public_handle, avatar_url)
		VALUES ($1, NULLIF($2, ''), $3)
		RETURNING id::text
	`, displayName, user.Login, user.AvatarURL).Scan(&userID)
	if err == nil {
		return userID, nil
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		err = tx.QueryRow(ctx, `
			INSERT INTO users (display_name, public_handle, avatar_url)
			VALUES ($1, NULL, $2)
			RETURNING id::text
		`, displayName, user.AvatarURL).Scan(&userID)
	}
	return userID, err
}

func insertGitHubAccount(ctx context.Context, tx pgx.Tx, userID string, user githubapi.CurrentUser, email, clientMode, scope string, now time.Time) (string, error) {
	var accountID string
	err := tx.QueryRow(ctx, `
		INSERT INTO github_accounts (
			user_id,
			github_user_id,
			login,
			node_id,
			access_mode,
			oauth_scopes,
			email,
			avatar_url,
			display_name,
			user_type,
			site_admin,
			linked_at,
			link_status,
			created_at,
			updated_at
		) VALUES (
			$1::uuid, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10, $11, $12, 'linked', $12, $12
		)
		RETURNING id::text
	`, userID, user.ID, user.Login, user.NodeID, clientMode, splitScope(scope), email, user.AvatarURL, preferredDisplayName(user), user.Type, user.SiteAdmin, now.UTC()).Scan(&accountID)
	return accountID, err
}

func updateUserFromGitHub(ctx context.Context, tx pgx.Tx, userID string, user githubapi.CurrentUser) error {
	_, err := tx.Exec(ctx, `
		UPDATE users
		SET display_name = $2,
			avatar_url = $3,
			updated_at = NOW()
		WHERE id = $1::uuid
	`, userID, preferredDisplayName(user), user.AvatarURL)
	return err
}

func updateGitHubAccount(ctx context.Context, tx pgx.Tx, accountID string, user githubapi.CurrentUser, email, clientMode, scope string, now time.Time, linked bool) error {
	linkStatus := "unlinked"
	if linked {
		linkStatus = "linked"
	}
	_, err := tx.Exec(ctx, `
		UPDATE github_accounts
		SET login = $2,
			node_id = $3,
			access_mode = $4,
			oauth_scopes = $5::text[],
			email = $6,
			avatar_url = $7,
			display_name = $8,
			user_type = $9,
			site_admin = $10,
			linked_at = CASE WHEN $11 THEN $12 ELSE linked_at END,
			unlinked_at = CASE WHEN $11 THEN NULL ELSE unlinked_at END,
			link_status = $13,
			updated_at = $12
		WHERE id = $1::uuid
	`, accountID, user.Login, user.NodeID, clientMode, splitScope(scope), email, user.AvatarURL, preferredDisplayName(user), user.Type, user.SiteAdmin, linked, now.UTC(), linkStatus)
	return err
}

func upsertGitHubToken(ctx context.Context, tx pgx.Tx, accountID string, input CompleteAuthInput, now time.Time) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO github_user_tokens (
			github_account_id,
			access_token_encrypted,
			refresh_token_encrypted,
			token_type,
			scope,
			expires_at,
			refresh_token_expires_at,
			issued_at,
			last_used_at,
			last_refreshed_at,
			last_refresh_error,
			revoked_at,
			revoked_reason
		) VALUES (
			$1::uuid, $2, $3, $4, $5, $6, $7, $8, $8, $8, '', NULL, ''
		)
		ON CONFLICT (github_account_id) DO UPDATE SET
			access_token_encrypted = EXCLUDED.access_token_encrypted,
			refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
			token_type = EXCLUDED.token_type,
			scope = EXCLUDED.scope,
			expires_at = EXCLUDED.expires_at,
			refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
			last_used_at = EXCLUDED.last_used_at,
			last_refreshed_at = EXCLUDED.last_refreshed_at,
			last_refresh_error = '',
			revoked_at = NULL,
			revoked_reason = ''
	`, accountID, input.AccessToken, input.RefreshToken, input.TokenType, input.OAuthScope, input.AccessExpiresAt, input.RefreshExpiresAt, now.UTC())
	return err
}

func insertSession(ctx context.Context, tx pgx.Tx, userID, accountID string, input CompleteAuthInput) (string, error) {
	var sessionID string
	err := tx.QueryRow(ctx, `
		INSERT INTO auth_sessions (
			user_id,
			github_account_id,
			session_token_hash,
			csrf_token_hash,
			roles,
			request_ip,
			user_agent,
			github_authorization_status,
			created_at,
			last_seen_at,
			last_refreshed_at,
			rotated_at,
			expires_at,
			idle_expires_at
		) VALUES (
			$1::uuid, $2::uuid, $3, $4, $5::text[], $6, $7, 'active', $8, $8, $8, $8, $9, $10
		)
		RETURNING id::text
	`, userID, accountID, input.SessionTokenHash, input.CSRFTokenHash, input.Roles, input.RequestIP, input.UserAgent, input.Now.UTC(), input.SessionExpiresAt.UTC(), input.SessionIdleExpiry.UTC()).Scan(&sessionID)
	return sessionID, err
}

func insertAudit(ctx context.Context, q queryer, actorType, actorID, action, targetType, targetID string, metadata map[string]any) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
	payload, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = q.Exec(ctx, `
		INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, metadata_jsonb)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb)
	`, actorType, actorID, action, targetType, targetID, string(payload))
	return err
}

func preferredDisplayName(user githubapi.CurrentUser) string {
	if strings.TrimSpace(user.Name) != "" {
		return strings.TrimSpace(user.Name)
	}
	return strings.TrimSpace(user.Login)
}

func splitScope(scope string) []string {
	scope = strings.TrimSpace(scope)
	if scope == "" {
		return []string{}
	}
	parts := strings.FieldsFunc(scope, func(r rune) bool {
		return r == ',' || r == ' '
	})
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func optionalTime(ok bool, value time.Time) *time.Time {
	if !ok {
		return nil
	}
	value = value.UTC()
	return &value
}

func buildEncryptedTokenFields(key []byte, accessToken, refreshToken string) (string, string, error) {
	accessEncrypted, err := authkit.EncryptSecret(key, accessToken)
	if err != nil {
		return "", "", err
	}
	refreshEncrypted, err := authkit.EncryptSecret(key, refreshToken)
	if err != nil {
		return "", "", err
	}
	return accessEncrypted, refreshEncrypted, nil
}
