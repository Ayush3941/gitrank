package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/authkit"
	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/githubapi"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	intentLogin = "login"
	intentLink  = "link"

	githubAuthorizationActive              = "active"
	githubAuthorizationReauthorizeRequired = "reauthorize_required"
)

type Service struct {
	cfg           config.App
	log           *slog.Logger
	store         *Store
	limiter       *RateLimiter
	httpClient    *http.Client
	sessionSecret []byte
	tokenKey      []byte
	githubMetrics *githubRateLimitMetrics
}

type OAuthStartResult struct {
	Response     contracts.GitHubAuthStartResponse
	BrowserToken string
}

type AccountLinkStartResult struct {
	Response     contracts.AccountLinkStartResponse
	BrowserToken string
}

type SessionTokens struct {
	SessionToken string
	CSRFToken    string
}

type OAuthCallbackResult struct {
	Response   contracts.OAuthCompletionResponse
	Session    SessionTokens
	ClearOAuth bool
}

type SessionResult struct {
	Response contracts.SessionEnvelope
	Session  *SessionTokens
}

func New(cfg config.App, pool *pgxpool.Pool, log *slog.Logger) (*Service, error) {
	if err := cfg.ValidateAuthService(); err != nil {
		return nil, err
	}
	tokenKey, err := authkit.DecodeBase64Key(cfg.Auth.TokenEncryptionKey)
	if err != nil {
		return nil, err
	}
	return &Service{
		cfg:           cfg,
		log:           log,
		store:         NewStore(pool),
		limiter:       NewRateLimiter(cfg.Auth.RateLimitWindow, cfg.Auth.RateLimitMaxAttempts),
		httpClient:    &http.Client{Timeout: cfg.GitHub.RequestTimeout},
		sessionSecret: []byte(cfg.Auth.SessionSecret),
		tokenKey:      tokenKey,
		githubMetrics: newGitHubRateLimitMetrics(cfg.ServiceName),
	}, nil
}

func (s *Service) Ready(ctx context.Context) error {
	return s.store.Ping(ctx)
}

func (s *Service) MetricsSource() httpkit.PrometheusSource {
	if s == nil {
		return nil
	}
	return s.githubMetrics
}

func (s *Service) AllowRateLimit(scope, clientIP string, now time.Time) (time.Duration, bool) {
	allowed, retryAfter := s.limiter.Allow(scope+":"+strings.TrimSpace(clientIP), now.UTC())
	return retryAfter, allowed
}

func (s *Service) StartLogin(ctx context.Context, returnTo, requestIP, userAgent string, now time.Time) (OAuthStartResult, error) {
	return s.startOAuth(ctx, intentLogin, "", returnTo, requestIP, userAgent, now)
}

func (s *Service) StartLink(ctx context.Context, sessionToken, csrfToken, returnTo, requestIP, userAgent string, now time.Time) (AccountLinkStartResult, error) {
	session, _, err := s.authenticateSession(ctx, sessionToken, now, false)
	if err != nil {
		return AccountLinkStartResult{}, err
	}
	if err := s.validateCSRF(sessionToken, csrfToken); err != nil {
		return AccountLinkStartResult{}, err
	}

	start, err := s.startOAuth(ctx, intentLink, session.UserID, returnTo, requestIP, userAgent, now)
	if err != nil {
		return AccountLinkStartResult{}, err
	}
	return AccountLinkStartResult{
		Response: contracts.AccountLinkStartResponse{
			Provider:     start.Response.Provider,
			ClientMode:   start.Response.ClientMode,
			Intent:       start.Response.Intent,
			AuthorizeURL: start.Response.AuthorizeURL,
			ReturnTo:     start.Response.ReturnTo,
			ExpiresAt:    start.Response.ExpiresAt,
		},
		BrowserToken: start.BrowserToken,
	}, nil
}

func (s *Service) HandleCallback(ctx context.Context, stateToken, code, browserToken, currentSessionToken, requestIP, userAgent string, now time.Time) (OAuthCallbackResult, error) {
	if strings.TrimSpace(code) == "" {
		return OAuthCallbackResult{}, errors.New("missing OAuth code")
	}
	if strings.TrimSpace(browserToken) == "" {
		return OAuthCallbackResult{}, errors.New("missing OAuth browser token")
	}

	stateClaims, err := authkit.ValidateStateToken(s.sessionSecret, stateToken, now)
	if err != nil {
		_ = s.store.Audit(ctx, "anonymous", "", "auth.oauth_callback_failed", "oauth_state", "", map[string]any{
			"reason": "invalid_state",
		})
		return OAuthCallbackResult{}, err
	}
	browserHash, err := authkit.HashOpaqueToken(s.sessionSecret, browserToken)
	if err != nil {
		return OAuthCallbackResult{}, err
	}
	state, err := s.store.ConsumeOAuthState(ctx, stateClaims.Nonce, browserHash, now)
	if err != nil {
		_ = s.store.Audit(ctx, "anonymous", "", "auth.oauth_callback_failed", "oauth_state", stateClaims.Nonce, map[string]any{
			"reason": "state_replay_or_expired",
		})
		return OAuthCallbackResult{}, err
	}

	token, err := githubapi.ExchangeUserAccessToken(ctx, s.httpClient, s.cfg.GitHub.TokenURL, githubapi.UserAccessTokenRequest{
		ClientID:     s.cfg.GitHubUserClientID(),
		ClientSecret: s.cfg.GitHubUserClientSecret(),
		Code:         code,
		RedirectURL:  s.cfg.GitHub.OAuthRedirectURL,
	})
	if err != nil {
		_ = s.store.Audit(ctx, "anonymous", "", "auth.oauth_callback_failed", "oauth_state", state.Nonce, map[string]any{
			"reason":      "token_exchange_failed",
			"client_mode": state.ClientMode,
		})
		return OAuthCallbackResult{}, err
	}
	if strings.TrimSpace(token.AccessToken) == "" {
		return OAuthCallbackResult{}, errors.New("GitHub returned empty access token")
	}

	ghUser, email, err := s.fetchGitHubIdentity(ctx, token.AccessToken)
	if err != nil {
		_ = s.store.Audit(ctx, "anonymous", "", "auth.oauth_callback_failed", "oauth_state", state.Nonce, map[string]any{
			"reason":      "github_identity_fetch_failed",
			"client_mode": state.ClientMode,
		})
		return OAuthCallbackResult{}, err
	}

	var priorSessionID string
	if state.Intent == intentLink {
		currentSession, _, err := s.authenticateSession(ctx, currentSessionToken, now, false)
		if err != nil {
			return OAuthCallbackResult{}, err
		}
		if currentSession.UserID != state.LinkingUserID {
			return OAuthCallbackResult{}, ErrConflict
		}
		priorSessionID = currentSession.SessionID
	} else if strings.TrimSpace(currentSessionToken) != "" {
		currentSession, _, err := s.authenticateSession(ctx, currentSessionToken, now, false)
		if err == nil {
			priorSessionID = currentSession.SessionID
		}
	}

	sessionToken, csrfToken, sessionTokenHash, csrfTokenHash, err := s.newSessionSecrets()
	if err != nil {
		return OAuthCallbackResult{}, err
	}
	accessEncrypted, refreshEncrypted, err := buildEncryptedTokenFields(s.tokenKey, token.AccessToken, token.RefreshToken)
	if err != nil {
		return OAuthCallbackResult{}, err
	}
	accessExpiresAt := optionalDeadline(now, token.ExpiresIn)
	refreshExpiresAt := optionalDeadline(now, token.RefreshTokenExpiresIn)

	roles := s.rolesForLogin(ghUser.Login)
	session, err := s.store.CompleteAuth(ctx, CompleteAuthInput{
		Intent:            state.Intent,
		LinkingUserID:     state.LinkingUserID,
		GitHubUser:        ghUser,
		Email:             email,
		ClientMode:        state.ClientMode,
		OAuthScope:        token.Scope,
		AccessToken:       accessEncrypted,
		RefreshToken:      refreshEncrypted,
		TokenType:         token.TokenType,
		AccessExpiresAt:   accessExpiresAt,
		RefreshExpiresAt:  refreshExpiresAt,
		SessionTokenHash:  sessionTokenHash,
		CSRFTokenHash:     csrfTokenHash,
		Roles:             roles,
		RequestIP:         requestIP,
		UserAgent:         userAgent,
		SessionExpiresAt:  now.UTC().Add(s.cfg.Auth.SessionTTL),
		SessionIdleExpiry: now.UTC().Add(s.cfg.Auth.SessionIdleTTL),
		RotatedAt:         now.UTC(),
		UsedStateNonce:    state.Nonce,
		PriorSessionID:    priorSessionID,
		Now:               now.UTC(),
	})
	if err != nil {
		auditActor := "anonymous"
		auditID := ""
		if state.Intent == intentLink {
			auditActor = "user"
			auditID = state.LinkingUserID
		}
		_ = s.store.Audit(ctx, auditActor, auditID, "auth.oauth_callback_failed", "github_user", fmt.Sprintf("%d", ghUser.ID), map[string]any{
			"reason": "account_finalize_failed",
			"intent": state.Intent,
		})
		return OAuthCallbackResult{}, err
	}

	response := contracts.OAuthCompletionResponse{
		Provider:    "github",
		ClientMode:  state.ClientMode,
		Intent:      state.Intent,
		RedirectURL: state.ReturnTo,
		Session:     sessionToContract(session),
	}
	return OAuthCallbackResult{
		Response: response,
		Session: SessionTokens{
			SessionToken: sessionToken,
			CSRFToken:    csrfToken,
		},
		ClearOAuth: true,
	}, nil
}

func (s *Service) GetSession(ctx context.Context, sessionToken string, now time.Time) (SessionResult, error) {
	session, rotated, err := s.authenticateSession(ctx, sessionToken, now, true)
	if err != nil {
		return SessionResult{}, err
	}
	result := SessionResult{
		Response: contracts.SessionEnvelope{
			Session:    sessionToContract(session),
			CSRFHeader: "X-CSRF-Token",
			CSRFHint:   s.cfg.Auth.CSRFCookieName,
		},
	}
	if rotated != nil {
		result.Session = rotated
	}
	return result, nil
}

func (s *Service) RefreshSession(ctx context.Context, sessionToken, csrfToken string, now time.Time) (SessionResult, error) {
	session, _, err := s.authenticateSession(ctx, sessionToken, now, true)
	if err != nil {
		return SessionResult{}, err
	}
	if err := s.validateCSRF(sessionToken, csrfToken); err != nil {
		return SessionResult{}, err
	}

	newSessionToken, newCSRFToken, sessionTokenHash, csrfTokenHash, err := s.newSessionSecrets()
	if err != nil {
		return SessionResult{}, err
	}

	rotated, err := s.store.RotateSession(ctx, RotateSessionInput{
		SessionID:                 session.SessionID,
		GitHubAccountID:           session.GitHubAccountID,
		SessionTokenHash:          sessionTokenHash,
		CSRFTokenHash:             csrfTokenHash,
		GitHubAuthorizationStatus: session.GitHubAuthorizationStatus,
		Roles:                     session.Roles,
		RotatedAt:                 now.UTC(),
		ExpiresAt:                 now.UTC().Add(s.cfg.Auth.SessionTTL),
		IdleExpiresAt:             now.UTC().Add(s.cfg.Auth.SessionIdleTTL),
		RefreshAbsoluteExpiry:     true,
	})
	if err != nil {
		return SessionResult{}, err
	}
	if err := s.store.Audit(ctx, "user", session.UserID, "auth.session_refreshed", "session", session.SessionID, map[string]any{
		"github_login": session.GitHubLogin,
	}); err != nil {
		s.log.Warn("audit failed", "error", err, "action", "auth.session_refreshed")
	}

	return SessionResult{
		Response: contracts.SessionEnvelope{
			Session:    sessionToContract(rotated),
			CSRFHeader: "X-CSRF-Token",
			CSRFHint:   s.cfg.Auth.CSRFCookieName,
		},
		Session: &SessionTokens{
			SessionToken: newSessionToken,
			CSRFToken:    newCSRFToken,
		},
	}, nil
}

func (s *Service) Logout(ctx context.Context, sessionToken, csrfToken string, now time.Time) error {
	session, _, err := s.authenticateSession(ctx, sessionToken, now, false)
	if err != nil {
		return err
	}
	if err := s.validateCSRF(sessionToken, csrfToken); err != nil {
		return err
	}
	if err := s.store.InvalidateSession(ctx, session.SessionID, "user_logout", now); err != nil {
		return err
	}
	if err := s.store.Audit(ctx, "user", session.UserID, "auth.logout", "session", session.SessionID, map[string]any{
		"github_login": session.GitHubLogin,
	}); err != nil {
		s.log.Warn("audit failed", "error", err, "action", "auth.logout")
	}
	return nil
}

func (s *Service) UnlinkAccount(ctx context.Context, sessionToken, csrfToken string, now time.Time) error {
	session, _, err := s.authenticateSession(ctx, sessionToken, now, false)
	if err != nil {
		return err
	}
	if err := s.validateCSRF(sessionToken, csrfToken); err != nil {
		return err
	}
	return s.store.UnlinkAccount(ctx, session.UserID, session.GitHubAccountID, now)
}

func (s *Service) DeleteAccount(ctx context.Context, sessionToken, csrfToken string, now time.Time) error {
	session, _, err := s.authenticateSession(ctx, sessionToken, now, false)
	if err != nil {
		return err
	}
	if err := s.validateCSRF(sessionToken, csrfToken); err != nil {
		return err
	}
	return s.store.DeleteAccount(ctx, session.UserID, session.GitHubAccountID, now)
}

func (s *Service) startOAuth(ctx context.Context, intent, linkingUserID, returnTo, requestIP, userAgent string, now time.Time) (OAuthStartResult, error) {
	stateNonce, err := authkit.NewOpaqueToken(24)
	if err != nil {
		return OAuthStartResult{}, err
	}
	browserToken, err := authkit.NewOpaqueToken(24)
	if err != nil {
		return OAuthStartResult{}, err
	}
	stateToken, err := authkit.NewStateToken(s.sessionSecret, stateNonce, s.cfg.Auth.OAuthStateTTL, now)
	if err != nil {
		return OAuthStartResult{}, err
	}
	browserHash, err := authkit.HashOpaqueToken(s.sessionSecret, browserToken)
	if err != nil {
		return OAuthStartResult{}, err
	}

	redirectTarget := s.normalizeReturnTo(returnTo, intent)
	if err := s.store.CreateOAuthState(ctx, stateNonce, browserHash, intent, s.cfg.GitHubUserClientMode(), redirectTarget, linkingUserID, requestIP, userAgent, now.UTC().Add(s.cfg.Auth.OAuthStateTTL)); err != nil {
		return OAuthStartResult{}, err
	}
	if err := s.store.Audit(ctx, actorTypeForIntent(intent), linkingUserID, "auth.oauth_started", "oauth_state", stateNonce, map[string]any{
		"intent":      intent,
		"client_mode": s.cfg.GitHubUserClientMode(),
	}); err != nil {
		s.log.Warn("audit failed", "error", err, "action", "auth.oauth_started")
	}

	redirectURL, err := githubapi.BuildAuthorizeURL(githubapi.OAuthConfig{
		AuthorizeURL: s.cfg.GitHub.AuthorizeURL,
		ClientID:     s.cfg.GitHubUserClientID(),
		RedirectURL:  s.cfg.GitHub.OAuthRedirectURL,
		Scopes:       s.cfg.GitHubUserAuthorizeScopes(),
		AllowSignup:  true,
	}, stateToken)
	if err != nil {
		return OAuthStartResult{}, err
	}

	return OAuthStartResult{
		Response: contracts.GitHubAuthStartResponse{
			Provider:     "github",
			ClientMode:   s.cfg.GitHubUserClientMode(),
			Intent:       intent,
			AuthorizeURL: redirectURL,
			Scopes:       slices.Clone(s.cfg.GitHubUserAuthorizeScopes()),
			ReturnTo:     redirectTarget,
			ExpiresAt:    now.UTC().Add(s.cfg.Auth.OAuthStateTTL),
		},
		BrowserToken: browserToken,
	}, nil
}

func (s *Service) authenticateSession(ctx context.Context, sessionToken string, now time.Time, allowRotation bool) (SessionView, *SessionTokens, error) {
	if strings.TrimSpace(sessionToken) == "" {
		return SessionView{}, nil, ErrSessionNotFound
	}
	sessionHash, err := authkit.HashOpaqueToken(s.sessionSecret, sessionToken)
	if err != nil {
		return SessionView{}, nil, err
	}
	session, err := s.store.LoadSessionByTokenHash(ctx, sessionHash, now)
	if err != nil {
		return SessionView{}, nil, err
	}
	if err := s.store.TouchSession(ctx, session.SessionID, now.UTC(), now.UTC().Add(s.cfg.Auth.SessionIdleTTL)); err != nil {
		return SessionView{}, nil, err
	}
	session.SessionLastSeenAt = now.UTC()
	session.SessionIdleExpiresAt = now.UTC().Add(s.cfg.Auth.SessionIdleTTL)

	if err := s.ensureGitHubAuthorization(ctx, &session, now); err != nil {
		return SessionView{}, nil, err
	}

	if allowRotation && now.UTC().Sub(session.SessionRotatedAt) >= s.cfg.Auth.SessionRotationInterval {
		newSessionToken, newCSRFToken, sessionTokenHash, csrfTokenHash, err := s.newSessionSecrets()
		if err != nil {
			return SessionView{}, nil, err
		}
		rotated, err := s.store.RotateSession(ctx, RotateSessionInput{
			SessionID:                 session.SessionID,
			GitHubAccountID:           session.GitHubAccountID,
			SessionTokenHash:          sessionTokenHash,
			CSRFTokenHash:             csrfTokenHash,
			GitHubAuthorizationStatus: session.GitHubAuthorizationStatus,
			Roles:                     session.Roles,
			RotatedAt:                 now.UTC(),
			ExpiresAt:                 session.SessionExpiresAt,
			IdleExpiresAt:             now.UTC().Add(s.cfg.Auth.SessionIdleTTL),
			RefreshAbsoluteExpiry:     false,
		})
		if err != nil {
			return SessionView{}, nil, err
		}
		if err := s.store.Audit(ctx, "user", session.UserID, "auth.session_rotated", "session", session.SessionID, map[string]any{
			"reason": "rotation_interval_elapsed",
		}); err != nil {
			s.log.Warn("audit failed", "error", err, "action", "auth.session_rotated")
		}
		return rotated, &SessionTokens{SessionToken: newSessionToken, CSRFToken: newCSRFToken}, nil
	}

	return session, nil, nil
}

func (s *Service) ensureGitHubAuthorization(ctx context.Context, session *SessionView, now time.Time) error {
	tokenRecord, err := s.store.LoadGitHubToken(ctx, session.GitHubAccountID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			session.GitHubAuthorizationStatus = githubAuthorizationReauthorizeRequired
			_ = s.store.UpdateSessionAuthorizationStatus(ctx, session.SessionID, githubAuthorizationReauthorizeRequired)
			return nil
		}
		return err
	}
	if tokenRecord.RevokedAt != nil {
		session.GitHubAuthorizationStatus = githubAuthorizationReauthorizeRequired
		_ = s.store.UpdateSessionAuthorizationStatus(ctx, session.SessionID, githubAuthorizationReauthorizeRequired)
		return nil
	}
	if tokenRecord.ExpiresAt == nil || tokenRecord.ExpiresAt.After(now.UTC().Add(time.Minute)) {
		session.GitHubAuthorizationStatus = githubAuthorizationActive
		return s.store.UpdateSessionAuthorizationStatus(ctx, session.SessionID, githubAuthorizationActive)
	}
	if strings.TrimSpace(tokenRecord.RefreshTokenEncrypted) == "" || (tokenRecord.RefreshTokenExpiresAt != nil && !tokenRecord.RefreshTokenExpiresAt.After(now.UTC())) {
		session.GitHubAuthorizationStatus = githubAuthorizationReauthorizeRequired
		_ = s.store.MarkTokenRevoked(ctx, session.GitHubAccountID, "github_token_expired", now)
		_ = s.store.UpdateSessionAuthorizationStatus(ctx, session.SessionID, githubAuthorizationReauthorizeRequired)
		return nil
	}

	refreshToken, err := authkit.DecryptSecret(s.tokenKey, tokenRecord.RefreshTokenEncrypted)
	if err != nil {
		return err
	}
	refreshed, err := githubapi.RefreshUserAccessToken(ctx, s.httpClient, s.cfg.GitHub.TokenURL, s.cfg.GitHubUserClientID(), s.cfg.GitHubUserClientSecret(), refreshToken)
	if err != nil {
		_ = s.store.MarkTokenRevoked(ctx, session.GitHubAccountID, "github_token_refresh_failed", now)
		_ = s.store.UpdateSessionAuthorizationStatus(ctx, session.SessionID, githubAuthorizationReauthorizeRequired)
		_ = s.store.Audit(ctx, "user", session.UserID, "auth.github_token_refresh_failed", "github_account", session.GitHubAccountID, map[string]any{
			"github_login": session.GitHubLogin,
		})
		session.GitHubAuthorizationStatus = githubAuthorizationReauthorizeRequired
		return nil
	}

	accessEncrypted, refreshEncrypted, err := buildEncryptedTokenFields(s.tokenKey, refreshed.AccessToken, refreshed.RefreshToken)
	if err != nil {
		return err
	}
	if refreshed.RefreshToken == "" {
		refreshEncrypted = tokenRecord.RefreshTokenEncrypted
	}
	accessExpiresAt := optionalDeadline(now, refreshed.ExpiresIn)
	refreshExpiresAt := optionalDeadline(now, refreshed.RefreshTokenExpiresIn)
	if refreshExpiresAt == nil {
		refreshExpiresAt = tokenRecord.RefreshTokenExpiresAt
	}
	if err := s.store.StoreRefreshedGitHubToken(ctx, session.GitHubAccountID, refreshed, accessEncrypted, refreshEncrypted, accessExpiresAt, refreshExpiresAt, now); err != nil {
		return err
	}
	if err := s.store.UpdateSessionAuthorizationStatus(ctx, session.SessionID, githubAuthorizationActive); err != nil {
		return err
	}
	if err := s.store.Audit(ctx, "user", session.UserID, "auth.github_token_refreshed", "github_account", session.GitHubAccountID, map[string]any{
		"github_login": session.GitHubLogin,
	}); err != nil {
		s.log.Warn("audit failed", "error", err, "action", "auth.github_token_refreshed")
	}
	session.GitHubAuthorizationStatus = githubAuthorizationActive
	return nil
}

func (s *Service) fetchGitHubIdentity(ctx context.Context, accessToken string) (githubapi.CurrentUser, string, error) {
	restClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          s.cfg.GitHub.APIBaseURL,
		APIVersion:       s.cfg.GitHub.APIVersion,
		UserAgent:        s.cfg.GitHub.UserAgent,
		TokenSource:      githubapi.StaticTokenSource(accessToken),
		HTTPClient:       s.httpClient,
		SecondaryBackoff: s.cfg.GitHub.SecondaryBackoff,
		MaxConcurrency:   1,
	})
	if err != nil {
		return githubapi.CurrentUser{}, "", err
	}
	user, meta, err := githubapi.GetCurrentUser(ctx, restClient)
	s.observeGitHubRateLimit(meta)
	if err != nil {
		return githubapi.CurrentUser{}, "", err
	}
	email := strings.TrimSpace(user.Email)
	if email == "" {
		emails, meta, err := githubapi.ListUserEmails(ctx, restClient)
		s.observeGitHubRateLimit(meta)
		if err == nil {
			email = githubapi.PrimaryVerifiedEmail(emails)
		}
	}
	return user, email, nil
}

func (s *Service) observeGitHubRateLimit(meta githubapi.ResponseMetadata) {
	if s == nil || s.githubMetrics == nil {
		return
	}
	s.githubMetrics.Observe(meta.RateLimit)
}

func (s *Service) validateCSRF(sessionToken, provided string) error {
	expected, err := authkit.DoubleSubmitCSRFFromToken(s.sessionSecret, sessionToken)
	if err != nil {
		return err
	}
	if strings.TrimSpace(provided) == "" || provided != expected {
		return ErrInvalidCSRF
	}
	return nil
}

func (s *Service) newSessionSecrets() (string, string, string, string, error) {
	sessionToken, err := authkit.NewOpaqueToken(32)
	if err != nil {
		return "", "", "", "", err
	}
	csrfToken, err := authkit.DoubleSubmitCSRFFromToken(s.sessionSecret, sessionToken)
	if err != nil {
		return "", "", "", "", err
	}
	sessionHash, err := authkit.HashOpaqueToken(s.sessionSecret, sessionToken)
	if err != nil {
		return "", "", "", "", err
	}
	return sessionToken, csrfToken, sessionHash, csrfToken, nil
}

func (s *Service) rolesForLogin(login string) []string {
	roles := []string{"user"}
	for _, admin := range s.cfg.Auth.AdminGitHubLogins {
		if strings.EqualFold(admin, login) {
			return []string{"user", "maintainer", "admin"}
		}
	}
	for _, maintainer := range s.cfg.Auth.MaintainerGitHubLogins {
		if strings.EqualFold(maintainer, login) {
			return []string{"user", "maintainer"}
		}
	}
	return roles
}

func (s *Service) normalizeReturnTo(raw, intent string) string {
	defaultPath := "/dashboard"
	if intent == intentLink {
		defaultPath = "/dashboard/settings"
	}
	base, err := url.Parse(strings.TrimRight(s.cfg.PublicBaseURL, "/") + defaultPath)
	if err != nil {
		return strings.TrimRight(s.cfg.PublicBaseURL, "/") + defaultPath
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return base.String()
	}
	if strings.HasPrefix(raw, "/") {
		target, err := url.Parse(raw)
		if err != nil || target.IsAbs() || target.Host != "" {
			return base.String()
		}
		resolved := base.ResolveReference(target)
		resolved.Fragment = ""
		return resolved.String()
	}
	target, err := url.Parse(raw)
	if err != nil {
		return base.String()
	}
	baseRoot, err := url.Parse(s.cfg.PublicBaseURL)
	if err != nil {
		return base.String()
	}
	if strings.EqualFold(target.Scheme, baseRoot.Scheme) && strings.EqualFold(target.Host, baseRoot.Host) {
		target.Fragment = ""
		return target.String()
	}
	return base.String()
}

func actorTypeForIntent(intent string) string {
	if intent == intentLink {
		return "user"
	}
	return "anonymous"
}

func optionalDeadline(now time.Time, ttl time.Duration) *time.Time {
	if ttl <= 0 {
		return nil
	}
	value := now.UTC().Add(ttl)
	return &value
}

func sessionToContract(session SessionView) contracts.SessionIdentity {
	return contracts.SessionIdentity{
		Subject:                   session.UserID,
		DisplayName:               session.DisplayName,
		AvatarURL:                 session.AvatarURL,
		GitHubLogin:               session.GitHubLogin,
		GitHubAuthorizationStatus: session.GitHubAuthorizationStatus,
		Roles:                     slices.Clone(session.Roles),
		SessionExpiresAt:          session.SessionExpiresAt,
		SessionIdleExpiresAt:      session.SessionIdleExpiresAt,
		SessionRotatedAt:          session.SessionRotatedAt,
		LinkedAccount: contracts.GitHubLinkedAccount{
			GitHubUserID: session.GitHubUserID,
			Login:        session.GitHubLogin,
			DisplayName:  session.GitHubDisplayName,
			Email:        session.GitHubEmail,
			AvatarURL:    session.GitHubAvatarURL,
			UserType:     session.GitHubUserType,
			AccessMode:   session.GitHubAccessMode,
			Scope:        session.GitHubScope,
			LinkedAt:     session.GitHubLinkedAt,
			UnlinkedAt:   session.GitHubUnlinkedAt,
			Status:       "linked",
		},
	}
}
