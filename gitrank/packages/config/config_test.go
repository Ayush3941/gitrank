package config

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"
)

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load("api-gateway", "API_GATEWAY_ADDR")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.ServiceName != "api-gateway" {
		t.Fatalf("ServiceName = %q, want api-gateway", cfg.ServiceName)
	}
	if cfg.Addr != ":8080" {
		t.Fatalf("Addr = %q, want :8080", cfg.Addr)
	}
	if cfg.ShutdownTimeout != 10*time.Second {
		t.Fatalf("ShutdownTimeout = %v, want 10s", cfg.ShutdownTimeout)
	}
	if cfg.GitHub.APIVersion != "2026-03-10" {
		t.Fatalf("GitHub.APIVersion = %q, want 2026-03-10", cfg.GitHub.APIVersion)
	}
	if cfg.GitHub.UserAgent != "GitRank/dev" {
		t.Fatalf("GitHub.UserAgent = %q, want GitRank/dev", cfg.GitHub.UserAgent)
	}
	if cfg.GitHub.RequestTimeout != 20*time.Second {
		t.Fatalf("GitHub.RequestTimeout = %v, want 20s", cfg.GitHub.RequestTimeout)
	}
	if cfg.Scheduler.WorkerConcurrency != 4 {
		t.Fatalf("Scheduler.WorkerConcurrency = %d, want 4", cfg.Scheduler.WorkerConcurrency)
	}
	if cfg.Scheduler.RunMode != "combined" {
		t.Fatalf("Scheduler.RunMode = %q, want combined", cfg.Scheduler.RunMode)
	}
	if cfg.Scheduler.DeadLetterQueue != "github-sync-dead-letter" {
		t.Fatalf("Scheduler.DeadLetterQueue = %q, want github-sync-dead-letter", cfg.Scheduler.DeadLetterQueue)
	}
	if cfg.Scheduler.PerUserRateMax != 6 {
		t.Fatalf("Scheduler.PerUserRateMax = %d, want 6", cfg.Scheduler.PerUserRateMax)
	}
	if cfg.Scheduler.PerInstallationRateMax != 18 {
		t.Fatalf("Scheduler.PerInstallationRateMax = %d, want 18", cfg.Scheduler.PerInstallationRateMax)
	}
	if cfg.GitHub.CircuitBreakerFailureThreshold != 5 {
		t.Fatalf("GitHub.CircuitBreakerFailureThreshold = %d, want 5", cfg.GitHub.CircuitBreakerFailureThreshold)
	}
	if cfg.GitHub.CircuitBreakerOpenInterval != 30*time.Second {
		t.Fatalf("GitHub.CircuitBreakerOpenInterval = %v, want 30s", cfg.GitHub.CircuitBreakerOpenInterval)
	}
	if cfg.GitHub.CircuitBreakerHalfOpenMax != 1 {
		t.Fatalf("GitHub.CircuitBreakerHalfOpenMax = %d, want 1", cfg.GitHub.CircuitBreakerHalfOpenMax)
	}
	if cfg.GitHub.AuthoredPRSyncLimit != 10 {
		t.Fatalf("GitHub.AuthoredPRSyncLimit = %d, want 10", cfg.GitHub.AuthoredPRSyncLimit)
	}
	if cfg.GitHub.AuthoredPRSearchLimit != 100 {
		t.Fatalf("GitHub.AuthoredPRSearchLimit = %d, want 100", cfg.GitHub.AuthoredPRSearchLimit)
	}
	if cfg.GitHub.RepositorySyncPageSize != 10 {
		t.Fatalf("GitHub.RepositorySyncPageSize = %d, want 10", cfg.GitHub.RepositorySyncPageSize)
	}
	if cfg.GitHub.PullRequestReviewPageSize != 10 {
		t.Fatalf("GitHub.PullRequestReviewPageSize = %d, want 10", cfg.GitHub.PullRequestReviewPageSize)
	}
	if cfg.GitHub.CommitSyncPageSize != 50 {
		t.Fatalf("GitHub.CommitSyncPageSize = %d, want 50", cfg.GitHub.CommitSyncPageSize)
	}
	if cfg.GitHub.UserRepositorySyncLimit != 100 {
		t.Fatalf("GitHub.UserRepositorySyncLimit = %d, want 100", cfg.GitHub.UserRepositorySyncLimit)
	}
	if cfg.GitHub.UserPRSyncTimeoutDefault != 20*time.Second {
		t.Fatalf("GitHub.UserPRSyncTimeoutDefault = %v, want 20s", cfg.GitHub.UserPRSyncTimeoutDefault)
	}
	if cfg.GitHub.UserPRSyncTimeoutMin != 10*time.Second {
		t.Fatalf("GitHub.UserPRSyncTimeoutMin = %v, want 10s", cfg.GitHub.UserPRSyncTimeoutMin)
	}
	if cfg.GitHub.UserPRSyncTimeoutMax != 60*time.Second {
		t.Fatalf("GitHub.UserPRSyncTimeoutMax = %v, want 60s", cfg.GitHub.UserPRSyncTimeoutMax)
	}
	if cfg.GitHub.RepositoryCacheTTL != 10*time.Minute {
		t.Fatalf("GitHub.RepositoryCacheTTL = %v, want 10m", cfg.GitHub.RepositoryCacheTTL)
	}
	if cfg.AI.PRMaxChangedFiles != 100 || cfg.AI.PRMaxFileRecords != 100 || cfg.AI.PRMaxEstimatedTokens != 30000 {
		t.Fatalf("AI PR limits = changed_files %d file_records %d tokens %d, want defaults", cfg.AI.PRMaxChangedFiles, cfg.AI.PRMaxFileRecords, cfg.AI.PRMaxEstimatedTokens)
	}
	if cfg.Scoring.ScoreVersion != "v1alpha1" {
		t.Fatalf("Scoring.ScoreVersion = %q, want v1alpha1", cfg.Scoring.ScoreVersion)
	}
	if cfg.Scoring.BaseXP != 100 || cfg.Scoring.MinXP != 10 {
		t.Fatalf("Scoring base/min = %.2f/%d, want 100/10", cfg.Scoring.BaseXP, cfg.Scoring.MinXP)
	}
	if cfg.Scoring.LevelArchitectMinXP != 250 || cfg.Scoring.LevelMaintainerMinXP != 180 {
		t.Fatalf("Scoring level thresholds = architect %d maintainer %d, want 250/180", cfg.Scoring.LevelArchitectMinXP, cfg.Scoring.LevelMaintainerMinXP)
	}
	if cfg.AI.Provider != "gemini" {
		t.Fatalf("AI.Provider = %q, want gemini", cfg.AI.Provider)
	}
	if cfg.AI.Model != "gemini-2.5-flash" {
		t.Fatalf("AI.Model = %q, want gemini-2.5-flash", cfg.AI.Model)
	}
	if cfg.AI.BaseURL != "https://generativelanguage.googleapis.com/v1beta/openai" {
		t.Fatalf("AI.BaseURL = %q, want Gemini OpenAI-compatible endpoint", cfg.AI.BaseURL)
	}
	if cfg.Auth.SessionCookieName != "gitrank_session" {
		t.Fatalf("Auth.SessionCookieName = %q, want gitrank_session", cfg.Auth.SessionCookieName)
	}
	if len(cfg.GitHub.OAuthScopes) != 2 || cfg.GitHub.OAuthScopes[0] != "read:user" || cfg.GitHub.OAuthScopes[1] != "user:email" {
		t.Fatalf("GitHub.OAuthScopes = %v, want read:user,user:email", cfg.GitHub.OAuthScopes)
	}
}

func TestLoadHonorsOverrides(t *testing.T) {
	t.Setenv("GITRANK_ENV", "production")
	t.Setenv("GITRANK_SERVICE_NAME", "custom-service")
	t.Setenv("API_GATEWAY_ADDR", ":9000")
	t.Setenv("GITRANK_SHUTDOWN_TIMEOUT", "20s")
	t.Setenv("GITRANK_PUBLIC_BASE_URL", "https://example.com")
	t.Setenv("GITRANK_API_BASE_URL", "https://api.example.com")
	t.Setenv("AUTH_SERVICE_BASE_URL", "https://auth.example.com")
	t.Setenv("AUTH_COOKIE_SAME_SITE", "strict")
	t.Setenv("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "12")
	t.Setenv("AUTH_ADMIN_GITHUB_LOGINS", "admin-login,octocat")
	t.Setenv("GITHUB_API_VERSION", "2022-11-28")
	t.Setenv("GITHUB_USER_AGENT", "GitRank/test")
	t.Setenv("GITHUB_OAUTH_EXCHANGE_URL", "https://github.example.com/login/oauth/access_token")
	t.Setenv("GITHUB_OAUTH_SCOPES", "read:user,user:email")
	t.Setenv("GITHUB_CIRCUIT_BREAKER_FAILURE_THRESHOLD", "7")
	t.Setenv("GITHUB_CIRCUIT_BREAKER_OPEN_INTERVAL", "45s")
	t.Setenv("GITHUB_CIRCUIT_BREAKER_HALF_OPEN_MAX_REQUESTS", "2")
	t.Setenv("GITHUB_REPOSITORY_CACHE_TTL", "30m")
	t.Setenv("GITHUB_REPOSITORY_SYNC_PAGE_SIZE", "15")
	t.Setenv("GITHUB_PULL_REQUEST_REVIEW_PAGE_SIZE", "22")
	t.Setenv("GITHUB_COMMIT_SYNC_PAGE_SIZE", "40")
	t.Setenv("GITHUB_USER_REPOSITORY_SYNC_LIMIT", "120")
	t.Setenv("GITHUB_AUTHORED_PR_SEARCH_LIMIT", "80")
	t.Setenv("GITHUB_AUTHORED_PR_SYNC_LIMIT", "12")
	t.Setenv("GITHUB_USER_PR_SYNC_TIMEOUT_DEFAULT", "30s")
	t.Setenv("GITHUB_USER_PR_SYNC_TIMEOUT_MIN", "12s")
	t.Setenv("GITHUB_USER_PR_SYNC_TIMEOUT_MAX", "75s")
	t.Setenv("GITHUB_INSTALLATION_REFRESH_SKEW", "7m")
	t.Setenv("AI_PROVIDER", "gemini")
	t.Setenv("GEMINI_API_KEY", "test-key")
	t.Setenv("GEMINI_MODEL", "gemini-2.5-pro")
	t.Setenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
	t.Setenv("AI_PR_MAX_CHANGED_FILES", "24")
	t.Setenv("AI_PR_MAX_FILE_RECORDS", "30")
	t.Setenv("AI_PR_MAX_DIFF_LINES", "900")
	t.Setenv("AI_PR_MAX_INPUT_CHARS", "16000")
	t.Setenv("AI_PR_MAX_ESTIMATED_TOKENS", "4000")
	t.Setenv("AI_PR_MAX_ESTIMATED_COST_USD", "0.08")
	t.Setenv("AI_ESTIMATED_INPUT_TOKEN_COST_USD", "0.00001")
	t.Setenv("SCORING_SCORE_VERSION", "v1beta2")
	t.Setenv("SCORING_BASE_XP", "130")
	t.Setenv("SCORING_MIN_XP", "15")
	t.Setenv("SCORING_CATEGORY_WEIGHT_FEATURE", "1.65")
	t.Setenv("SCORING_REPOSITORY_WEIGHT_MAX", "1.5")
	t.Setenv("SCORING_LEVEL_ARCHITECT_MIN_XP", "300")
	t.Setenv("JOB_WORKER_CONCURRENCY", "9")
	t.Setenv("SCHEDULER_RUN_MODE", "worker")
	t.Setenv("JOB_DEAD_LETTER_QUEUE", "custom-dead-letter")
	t.Setenv("JOB_PER_USER_RATE_MAX", "3")
	t.Setenv("JOB_PER_INSTALLATION_RATE_MAX", "11")

	cfg, err := Load("api-gateway", "API_GATEWAY_ADDR")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Env != Production {
		t.Fatalf("Env = %q, want production", cfg.Env)
	}
	if cfg.ServiceName != "custom-service" {
		t.Fatalf("ServiceName = %q, want custom-service", cfg.ServiceName)
	}
	if cfg.Addr != ":9000" {
		t.Fatalf("Addr = %q, want :9000", cfg.Addr)
	}
	if cfg.ShutdownTimeout != 20*time.Second {
		t.Fatalf("ShutdownTimeout = %v, want 20s", cfg.ShutdownTimeout)
	}
	if cfg.Services.AuthBaseURL != "https://auth.example.com" {
		t.Fatalf("AuthBaseURL = %q, want https://auth.example.com", cfg.Services.AuthBaseURL)
	}
	if cfg.Auth.SessionCookieSameSite != "strict" {
		t.Fatalf("Auth.SessionCookieSameSite = %q, want strict", cfg.Auth.SessionCookieSameSite)
	}
	if cfg.Auth.RateLimitMaxAttempts != 12 {
		t.Fatalf("Auth.RateLimitMaxAttempts = %d, want 12", cfg.Auth.RateLimitMaxAttempts)
	}
	if len(cfg.Auth.AdminGitHubLogins) != 2 || cfg.Auth.AdminGitHubLogins[0] != "admin-login" {
		t.Fatalf("Auth.AdminGitHubLogins = %v, want [admin-login octocat]", cfg.Auth.AdminGitHubLogins)
	}
	if cfg.GitHub.APIVersion != "2022-11-28" {
		t.Fatalf("GitHub.APIVersion = %q, want 2022-11-28", cfg.GitHub.APIVersion)
	}
	if cfg.GitHub.UserAgent != "GitRank/test" {
		t.Fatalf("GitHub.UserAgent = %q, want GitRank/test", cfg.GitHub.UserAgent)
	}
	if cfg.GitHub.TokenURL != "https://github.example.com/login/oauth/access_token" {
		t.Fatalf("GitHub.TokenURL = %q, want override", cfg.GitHub.TokenURL)
	}
	if len(cfg.GitHub.OAuthScopes) != 2 || cfg.GitHub.OAuthScopes[0] != "read:user" {
		t.Fatalf("GitHub.OAuthScopes = %v, want read:user,user:email", cfg.GitHub.OAuthScopes)
	}
	if cfg.GitHub.RefreshSkew != 7*time.Minute {
		t.Fatalf("GitHub.RefreshSkew = %v, want 7m", cfg.GitHub.RefreshSkew)
	}
	if cfg.GitHub.CircuitBreakerFailureThreshold != 7 {
		t.Fatalf("GitHub.CircuitBreakerFailureThreshold = %d, want 7", cfg.GitHub.CircuitBreakerFailureThreshold)
	}
	if cfg.GitHub.CircuitBreakerOpenInterval != 45*time.Second {
		t.Fatalf("GitHub.CircuitBreakerOpenInterval = %v, want 45s", cfg.GitHub.CircuitBreakerOpenInterval)
	}
	if cfg.GitHub.CircuitBreakerHalfOpenMax != 2 {
		t.Fatalf("GitHub.CircuitBreakerHalfOpenMax = %d, want 2", cfg.GitHub.CircuitBreakerHalfOpenMax)
	}
	if cfg.GitHub.RepositoryCacheTTL != 30*time.Minute {
		t.Fatalf("GitHub.RepositoryCacheTTL = %v, want 30m", cfg.GitHub.RepositoryCacheTTL)
	}
	if cfg.GitHub.AuthoredPRSyncLimit != 12 {
		t.Fatalf("GitHub.AuthoredPRSyncLimit = %d, want 12", cfg.GitHub.AuthoredPRSyncLimit)
	}
	if cfg.GitHub.AuthoredPRSearchLimit != 80 {
		t.Fatalf("GitHub.AuthoredPRSearchLimit = %d, want 80", cfg.GitHub.AuthoredPRSearchLimit)
	}
	if cfg.GitHub.RepositorySyncPageSize != 15 {
		t.Fatalf("GitHub.RepositorySyncPageSize = %d, want 15", cfg.GitHub.RepositorySyncPageSize)
	}
	if cfg.GitHub.PullRequestReviewPageSize != 22 {
		t.Fatalf("GitHub.PullRequestReviewPageSize = %d, want 22", cfg.GitHub.PullRequestReviewPageSize)
	}
	if cfg.GitHub.CommitSyncPageSize != 40 {
		t.Fatalf("GitHub.CommitSyncPageSize = %d, want 40", cfg.GitHub.CommitSyncPageSize)
	}
	if cfg.GitHub.UserRepositorySyncLimit != 120 {
		t.Fatalf("GitHub.UserRepositorySyncLimit = %d, want 120", cfg.GitHub.UserRepositorySyncLimit)
	}
	if cfg.GitHub.UserPRSyncTimeoutDefault != 30*time.Second {
		t.Fatalf("GitHub.UserPRSyncTimeoutDefault = %v, want 30s", cfg.GitHub.UserPRSyncTimeoutDefault)
	}
	if cfg.GitHub.UserPRSyncTimeoutMin != 12*time.Second {
		t.Fatalf("GitHub.UserPRSyncTimeoutMin = %v, want 12s", cfg.GitHub.UserPRSyncTimeoutMin)
	}
	if cfg.GitHub.UserPRSyncTimeoutMax != 75*time.Second {
		t.Fatalf("GitHub.UserPRSyncTimeoutMax = %v, want 75s", cfg.GitHub.UserPRSyncTimeoutMax)
	}
	if cfg.AI.PRMaxChangedFiles != 24 || cfg.AI.PRMaxFileRecords != 30 {
		t.Fatalf("AI file limits = changed %d files %d, want 24/30", cfg.AI.PRMaxChangedFiles, cfg.AI.PRMaxFileRecords)
	}
	if cfg.AI.Provider != "gemini" || cfg.AI.Model != "gemini-2.5-pro" {
		t.Fatalf("AI provider/model = %s/%s, want gemini/gemini-2.5-pro", cfg.AI.Provider, cfg.AI.Model)
	}
	if cfg.AI.PRMaxEstimatedCostUSD != 0.08 || cfg.AI.EstimatedInputTokenCostUSD != 0.00001 {
		t.Fatalf("AI cost limits = max %.5f token %.5f, want 0.08/0.00001", cfg.AI.PRMaxEstimatedCostUSD, cfg.AI.EstimatedInputTokenCostUSD)
	}
	if cfg.Scoring.ScoreVersion != "v1beta2" {
		t.Fatalf("Scoring.ScoreVersion = %q, want v1beta2", cfg.Scoring.ScoreVersion)
	}
	if cfg.Scoring.BaseXP != 130 || cfg.Scoring.MinXP != 15 {
		t.Fatalf("Scoring base/min = %.2f/%d, want 130/15", cfg.Scoring.BaseXP, cfg.Scoring.MinXP)
	}
	if cfg.Scoring.CategoryWeightFeature != 1.65 {
		t.Fatalf("Scoring.CategoryWeightFeature = %.2f, want 1.65", cfg.Scoring.CategoryWeightFeature)
	}
	if cfg.Scoring.RepositoryWeightMax != 1.5 {
		t.Fatalf("Scoring.RepositoryWeightMax = %.2f, want 1.5", cfg.Scoring.RepositoryWeightMax)
	}
	if cfg.Scoring.LevelArchitectMinXP != 300 {
		t.Fatalf("Scoring.LevelArchitectMinXP = %d, want 300", cfg.Scoring.LevelArchitectMinXP)
	}
	if cfg.Scheduler.WorkerConcurrency != 9 {
		t.Fatalf("Scheduler.WorkerConcurrency = %d, want 9", cfg.Scheduler.WorkerConcurrency)
	}
	if cfg.Scheduler.RunMode != "worker" {
		t.Fatalf("Scheduler.RunMode = %q, want worker", cfg.Scheduler.RunMode)
	}
	if cfg.Scheduler.DeadLetterQueue != "custom-dead-letter" {
		t.Fatalf("Scheduler.DeadLetterQueue = %q, want custom-dead-letter", cfg.Scheduler.DeadLetterQueue)
	}
	if cfg.Scheduler.PerUserRateMax != 3 {
		t.Fatalf("Scheduler.PerUserRateMax = %d, want 3", cfg.Scheduler.PerUserRateMax)
	}
	if cfg.Scheduler.PerInstallationRateMax != 11 {
		t.Fatalf("Scheduler.PerInstallationRateMax = %d, want 11", cfg.Scheduler.PerInstallationRateMax)
	}
}

func TestLoadRejectsInvalidSchedulerRunMode(t *testing.T) {
	t.Setenv("SCHEDULER_RUN_MODE", "sidecar")

	_, err := Load("scheduler-worker", "SCHEDULER_WORKER_ADDR")
	if err == nil {
		t.Fatal("Load() error = nil, want invalid scheduler run mode rejection")
	}
	if !strings.Contains(err.Error(), "SCHEDULER_RUN_MODE") {
		t.Fatalf("Load() error = %q, want SCHEDULER_RUN_MODE validation", err.Error())
	}
}

func TestLoadRejectsUnsafeHTTPURLs(t *testing.T) {
	t.Setenv("GITHUB_API_BASE_URL", "file://metadata/latest")

	_, err := Load("api-gateway", "API_GATEWAY_ADDR")
	if err == nil {
		t.Fatal("Load() error = nil, want unsafe URL rejection")
	}
}

func TestLoadRejectsBaseURLWithUserinfo(t *testing.T) {
	t.Setenv("AUTH_SERVICE_BASE_URL", "https://user:pass@auth.example.com")

	_, err := Load("api-gateway", "API_GATEWAY_ADDR")
	if err == nil {
		t.Fatal("Load() error = nil, want userinfo URL rejection")
	}
}

func TestValidateOAuth(t *testing.T) {
	cfg, err := Load("auth-service", "AUTH_SERVICE_ADDR")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.ValidateOAuth() == nil {
		t.Fatal("ValidateOAuth() expected error, got nil")
	}
}

func TestGitHubClientFallbacksAndInstallURL(t *testing.T) {
	t.Setenv("GITHUB_APP_CLIENT_ID", "app-client")
	t.Setenv("GITHUB_APP_CLIENT_SECRET", "app-secret")
	t.Setenv("GITHUB_APP_SLUG", "gitrank")
	t.Setenv("GITHUB_OAUTH_REDIRECT_URL", "https://example.com/callback")

	cfg, err := Load("auth-service", "AUTH_SERVICE_ADDR")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.GitHubUserClientID() != "app-client" {
		t.Fatalf("GitHubUserClientID() = %q, want app-client", cfg.GitHubUserClientID())
	}
	if cfg.GitHubUserClientSecret() != "app-secret" {
		t.Fatalf("GitHubUserClientSecret() = %q, want app-secret", cfg.GitHubUserClientSecret())
	}
	if cfg.GitHubInstallURL() != "https://github.com/apps/gitrank/installations/new" {
		t.Fatalf("GitHubInstallURL() = %q, want generated install URL", cfg.GitHubInstallURL())
	}
	if err := cfg.ValidateOAuth(); err != nil {
		t.Fatalf("ValidateOAuth() error = %v", err)
	}
}

func TestValidateAuthService(t *testing.T) {
	primaryEncryptionKey := base64.StdEncoding.EncodeToString([]byte(strings.Repeat("a", 32)))
	previousEncryptionKey := base64.StdEncoding.EncodeToString([]byte(strings.Repeat("b", 32)))

	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/gitrank?sslmode=disable")
	t.Setenv("GITRANK_SESSION_SECRET", "super-secret")
	t.Setenv("GITRANK_PREVIOUS_SESSION_SECRETS", "old-secret")
	t.Setenv("GITHUB_TOKEN_ENCRYPTION_KEY", primaryEncryptionKey)
	t.Setenv("GITHUB_PREVIOUS_TOKEN_ENCRYPTION_KEYS", previousEncryptionKey)
	t.Setenv("GITHUB_CLIENT_ID", "client")
	t.Setenv("GITHUB_CLIENT_SECRET", "secret")
	t.Setenv("GITHUB_OAUTH_REDIRECT_URL", "https://example.com/callback")

	cfg, err := Load("auth-service", "AUTH_SERVICE_ADDR")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if err := cfg.ValidateAuthService(); err != nil {
		t.Fatalf("ValidateAuthService() error = %v", err)
	}
	if got := cfg.SessionSecretRing(); len(got) != 2 || string(got[1]) != "old-secret" {
		t.Fatalf("SessionSecretRing() = %#v, want primary plus previous", got)
	}
	keys, err := cfg.TokenEncryptionKeyRing()
	if err != nil {
		t.Fatalf("TokenEncryptionKeyRing() error = %v", err)
	}
	if len(keys) != 2 {
		t.Fatalf("TokenEncryptionKeyRing() len = %d, want 2", len(keys))
	}
}

func TestValidatePRAnalyzerServiceRequiresDatabase(t *testing.T) {
	cfg, err := Load("pr-analyzer", "PR_ANALYZER_ADDR")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if err := cfg.ValidatePRAnalyzerService(); err == nil {
		t.Fatal("ValidatePRAnalyzerService() error = nil, want missing DATABASE_URL rejection")
	}

	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/gitrank?sslmode=disable")
	cfg, err = Load("pr-analyzer", "PR_ANALYZER_ADDR")
	if err != nil {
		t.Fatalf("Load() with database error = %v", err)
	}
	if err := cfg.ValidatePRAnalyzerService(); err != nil {
		t.Fatalf("ValidatePRAnalyzerService() error = %v", err)
	}
}
