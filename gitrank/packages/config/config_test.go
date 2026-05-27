package config

import (
	"encoding/base64"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"
)

func loadBackendEnvExample(t *testing.T) map[string]string {
	t.Helper()

	raw, err := os.ReadFile("../../.env.example")
	if err != nil {
		t.Fatalf("read .env.example: %v", err)
	}

	out := make(map[string]string)
	for _, line := range strings.Split(string(raw), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		key, value, ok := strings.Cut(trimmed, "=")
		if !ok {
			continue
		}
		out[strings.TrimSpace(key)] = strings.TrimSpace(value)
	}
	return out
}

func requireEnvString(t *testing.T, env map[string]string, key, got string) {
	t.Helper()
	want, ok := env[key]
	if !ok {
		t.Fatalf("%s missing from .env.example", key)
	}
	if got != want {
		t.Fatalf("%s = %q, want %q from .env.example", key, got, want)
	}
}

func requireEnvDuration(t *testing.T, env map[string]string, key string, got time.Duration) {
	t.Helper()
	wantRaw, ok := env[key]
	if !ok {
		t.Fatalf("%s missing from .env.example", key)
	}
	want, err := time.ParseDuration(wantRaw)
	if err != nil {
		t.Fatalf("%s invalid duration %q in .env.example: %v", key, wantRaw, err)
	}
	if got != want {
		t.Fatalf("%s = %v, want %v from .env.example", key, got, want)
	}
}

func requireEnvInt(t *testing.T, env map[string]string, key string, got int) {
	t.Helper()
	wantRaw, ok := env[key]
	if !ok {
		t.Fatalf("%s missing from .env.example", key)
	}
	want, err := strconv.Atoi(wantRaw)
	if err != nil {
		t.Fatalf("%s invalid integer %q in .env.example: %v", key, wantRaw, err)
	}
	if got != want {
		t.Fatalf("%s = %d, want %d from .env.example", key, got, want)
	}
}

func requireEnvBool(t *testing.T, env map[string]string, key string, got bool) {
	t.Helper()
	wantRaw, ok := env[key]
	if !ok {
		t.Fatalf("%s missing from .env.example", key)
	}
	wantRaw = strings.ToLower(strings.TrimSpace(wantRaw))
	want := wantRaw == "1" || wantRaw == "true" || wantRaw == "yes" || wantRaw == "on"
	if got != want {
		t.Fatalf("%s = %t, want %t from .env.example", key, got, want)
	}
}

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
	if cfg.GitHub.OAuthRedirectURL != "http://localhost:3000/oauth/github/callback" {
		t.Fatalf("GitHub.OAuthRedirectURL = %q, want frontend callback default", cfg.GitHub.OAuthRedirectURL)
	}
	if cfg.GitHub.AppID != "0" {
		t.Fatalf("GitHub.AppID = %q, want 0", cfg.GitHub.AppID)
	}
	if cfg.GitHub.AppClientID != "replace-me" || cfg.GitHub.AppClientSecret != "replace-me" {
		t.Fatalf("GitHub app client placeholders = %q/%q, want replace-me/replace-me", cfg.GitHub.AppClientID, cfg.GitHub.AppClientSecret)
	}
	if cfg.GitHubUserClientMode() != "oauth_app" {
		t.Fatalf("GitHubUserClientMode() = %q, want oauth_app when app values are placeholders", cfg.GitHubUserClientMode())
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
	if cfg.GitHub.InstallationRepositoryPageSize != 50 {
		t.Fatalf("GitHub.InstallationRepositoryPageSize = %d, want 50", cfg.GitHub.InstallationRepositoryPageSize)
	}
	if cfg.GitHub.InstallationRepositoryMaxPages != 10 {
		t.Fatalf("GitHub.InstallationRepositoryMaxPages = %d, want 10", cfg.GitHub.InstallationRepositoryMaxPages)
	}
	if cfg.GitHub.UserPRSyncTimeoutDefault != 45*time.Second {
		t.Fatalf("GitHub.UserPRSyncTimeoutDefault = %v, want 45s", cfg.GitHub.UserPRSyncTimeoutDefault)
	}
	if cfg.GitHub.UserPRSyncTimeoutMin != 20*time.Second {
		t.Fatalf("GitHub.UserPRSyncTimeoutMin = %v, want 20s", cfg.GitHub.UserPRSyncTimeoutMin)
	}
	if cfg.GitHub.UserPRSyncTimeoutMax != 90*time.Second {
		t.Fatalf("GitHub.UserPRSyncTimeoutMax = %v, want 90s", cfg.GitHub.UserPRSyncTimeoutMax)
	}
	if cfg.GitHub.RepositoryCacheTTL != 10*time.Minute {
		t.Fatalf("GitHub.RepositoryCacheTTL = %v, want 10m", cfg.GitHub.RepositoryCacheTTL)
	}
	if cfg.AI.PRMaxChangedFiles != 100 || cfg.AI.PRMaxFileRecords != 100 || cfg.AI.PRMaxEstimatedTokens != 30000 {
		t.Fatalf("AI PR limits = changed_files %d file_records %d tokens %d, want defaults", cfg.AI.PRMaxChangedFiles, cfg.AI.PRMaxFileRecords, cfg.AI.PRMaxEstimatedTokens)
	}
	if cfg.AI.SummaryMaxRunes != 320 || cfg.AI.SummaryPromptFilePathLimit != 12 {
		t.Fatalf("AI summary limits = runes %d prompt_paths %d, want 320/12", cfg.AI.SummaryMaxRunes, cfg.AI.SummaryPromptFilePathLimit)
	}
	if cfg.AI.AnalyzerPolicyJSON != "" {
		t.Fatalf("AI.AnalyzerPolicyJSON = %q, want empty default", cfg.AI.AnalyzerPolicyJSON)
	}
	if cfg.Scoring.ScoreVersion != "v1alpha1" {
		t.Fatalf("Scoring.ScoreVersion = %q, want v1alpha1", cfg.Scoring.ScoreVersion)
	}
	if cfg.Scoring.BaseXP != 100 || cfg.Scoring.MinXP != 10 {
		t.Fatalf("Scoring base/min = %.2f/%d, want 100/10", cfg.Scoring.BaseXP, cfg.Scoring.MinXP)
	}
	if cfg.Scoring.RankTierSilverMinXP != 1500 || cfg.Scoring.RankTierGoldMinXP != 4000 ||
		cfg.Scoring.RankTierPlatinumMinXP != 9000 || cfg.Scoring.RankTierDiamondMinXP != 15000 {
		t.Fatalf(
			"Scoring rank tier thresholds = %d/%d/%d/%d, want 1500/4000/9000/15000",
			cfg.Scoring.RankTierSilverMinXP,
			cfg.Scoring.RankTierGoldMinXP,
			cfg.Scoring.RankTierPlatinumMinXP,
			cfg.Scoring.RankTierDiamondMinXP,
		)
	}
	if cfg.Scoring.RankTierBronzeLabel != "Bronze I" || cfg.Scoring.RankTierSilverLabel != "Silver II" ||
		cfg.Scoring.RankTierGoldLabel != "Gold III" || cfg.Scoring.RankTierPlatinumLabel != "Platinum I" ||
		cfg.Scoring.RankTierDiamondLabel != "Diamond" {
		t.Fatalf("Scoring rank tier labels = %+v, want default labels", []string{
			cfg.Scoring.RankTierBronzeLabel,
			cfg.Scoring.RankTierSilverLabel,
			cfg.Scoring.RankTierGoldLabel,
			cfg.Scoring.RankTierPlatinumLabel,
			cfg.Scoring.RankTierDiamondLabel,
		})
	}
	if cfg.Scoring.LeaderboardPromotionRule == "" || cfg.Scoring.LeaderboardResetRule == "" {
		t.Fatalf("Scoring leaderboard rules must not be empty")
	}
	if cfg.Scoring.LeaderboardPromotionCutoffRank != 25 || cfg.Scoring.LeaderboardSafetyCutoffRank != 75 {
		t.Fatalf("Scoring leaderboard cutoffs = %d/%d, want 25/75", cfg.Scoring.LeaderboardPromotionCutoffRank, cfg.Scoring.LeaderboardSafetyCutoffRank)
	}
	if cfg.Scoring.LevelArchitectMinXP != 250 || cfg.Scoring.LevelMaintainerMinXP != 180 {
		t.Fatalf("Scoring level thresholds = architect %d maintainer %d, want 250/180", cfg.Scoring.LevelArchitectMinXP, cfg.Scoring.LevelMaintainerMinXP)
	}
	if cfg.AI.Provider != "openai" {
		t.Fatalf("AI.Provider = %q, want openai", cfg.AI.Provider)
	}
	if cfg.AI.Model != "gpt-4o-mini" {
		t.Fatalf("AI.Model = %q, want gpt-4o-mini", cfg.AI.Model)
	}
	if cfg.AI.BaseURL != "https://api.openai.com/v1" {
		t.Fatalf("AI.BaseURL = %q, want OpenAI API endpoint", cfg.AI.BaseURL)
	}
	if cfg.Auth.SessionCookieName != "gitrank_session" {
		t.Fatalf("Auth.SessionCookieName = %q, want gitrank_session", cfg.Auth.SessionCookieName)
	}
	if len(cfg.GitHub.OAuthScopes) != 2 || cfg.GitHub.OAuthScopes[0] != "read:user" || cfg.GitHub.OAuthScopes[1] != "user:email" {
		t.Fatalf("GitHub.OAuthScopes = %v, want read:user,user:email", cfg.GitHub.OAuthScopes)
	}
}

func TestLoadDefaultsMatchBackendEnvExample(t *testing.T) {
	env := loadBackendEnvExample(t)
	cfg, err := Load("api-gateway", "API_GATEWAY_ADDR")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	requireEnvString(t, env, "GITRANK_ENV", string(cfg.Env))
	requireEnvString(t, env, "GITRANK_PUBLIC_BASE_URL", cfg.PublicBaseURL)
	requireEnvString(t, env, "GITRANK_API_BASE_URL", cfg.APIBaseURL)
	requireEnvString(t, env, "API_GATEWAY_ADDR", cfg.Addr)
	requireEnvDuration(t, env, "GITRANK_SHUTDOWN_TIMEOUT", cfg.ShutdownTimeout)
	requireEnvString(t, env, "GITRANK_LOG_LEVEL", cfg.Log.Level)
	requireEnvString(t, env, "GITRANK_LOG_FORMAT", cfg.Log.Format)

	requireEnvString(t, env, "AUTH_SERVICE_BASE_URL", cfg.Services.AuthBaseURL)
	requireEnvString(t, env, "GITHUB_INGESTOR_BASE_URL", cfg.Services.GitHubIngestorBaseURL)
	requireEnvString(t, env, "PR_ANALYZER_BASE_URL", cfg.Services.PRAnalyzerBaseURL)
	requireEnvString(t, env, "PROFILE_SERVICE_BASE_URL", cfg.Services.ProfileBaseURL)
	requireEnvString(t, env, "SCORING_ENGINE_BASE_URL", cfg.Services.ScoringBaseURL)
	requireEnvString(t, env, "SCHEDULER_WORKER_BASE_URL", cfg.Services.SchedulerBaseURL)
	requireEnvDuration(t, env, "INTERNAL_API_REQUEST_TIMEOUT", cfg.Services.RequestTimeout)

	requireEnvString(t, env, "DATABASE_URL", cfg.Database.URL)
	requireEnvString(t, env, "REDIS_URL", cfg.Redis.URL)

	requireEnvString(t, env, "AUTH_SESSION_COOKIE_NAME", cfg.Auth.SessionCookieName)
	requireEnvString(t, env, "AUTH_CSRF_COOKIE_NAME", cfg.Auth.CSRFCookieName)
	requireEnvString(t, env, "AUTH_COOKIE_DOMAIN", cfg.Auth.SessionCookieDomain)
	requireEnvBool(t, env, "AUTH_COOKIE_SECURE", cfg.Auth.SessionCookieSecure)
	requireEnvString(t, env, "AUTH_COOKIE_SAME_SITE", cfg.Auth.SessionCookieSameSite)
	requireEnvDuration(t, env, "AUTH_SESSION_TTL", cfg.Auth.SessionTTL)
	requireEnvDuration(t, env, "AUTH_SESSION_IDLE_TTL", cfg.Auth.SessionIdleTTL)
	requireEnvDuration(t, env, "AUTH_SESSION_ROTATION_INTERVAL", cfg.Auth.SessionRotationInterval)
	requireEnvDuration(t, env, "AUTH_OAUTH_STATE_TTL", cfg.Auth.OAuthStateTTL)
	requireEnvDuration(t, env, "AUTH_RATE_LIMIT_WINDOW", cfg.Auth.RateLimitWindow)
	requireEnvInt(t, env, "AUTH_RATE_LIMIT_MAX_ATTEMPTS", cfg.Auth.RateLimitMaxAttempts)

	requireEnvString(t, env, "GITHUB_OAUTH_AUTHORIZE_URL", cfg.GitHub.AuthorizeURL)
	requireEnvString(t, env, "GITHUB_OAUTH_EXCHANGE_URL", cfg.GitHub.TokenURL)
	requireEnvString(t, env, "GITHUB_OAUTH_DEVICE_URL", cfg.GitHub.DeviceURL)
	requireEnvString(t, env, "GITHUB_OAUTH_REDIRECT_URL", cfg.GitHub.OAuthRedirectURL)
	requireEnvString(t, env, "GITHUB_API_BASE_URL", cfg.GitHub.APIBaseURL)
	requireEnvString(t, env, "GITHUB_GRAPHQL_URL", cfg.GitHub.GraphQLURL)
	requireEnvString(t, env, "GITHUB_API_VERSION", cfg.GitHub.APIVersion)
	requireEnvString(t, env, "GITHUB_USER_AGENT", cfg.GitHub.UserAgent)
	requireEnvDuration(t, env, "GITHUB_REQUEST_TIMEOUT", cfg.GitHub.RequestTimeout)
	requireEnvInt(t, env, "GITHUB_MAX_PAGE_SIZE", cfg.GitHub.MaxPageSize)
	requireEnvInt(t, env, "GITHUB_GRAPHQL_PAGE_SIZE", cfg.GitHub.GraphQLPageSize)
	requireEnvInt(t, env, "GITHUB_REPOSITORY_SYNC_PAGE_SIZE", cfg.GitHub.RepositorySyncPageSize)
	requireEnvInt(t, env, "GITHUB_PULL_REQUEST_REVIEW_PAGE_SIZE", cfg.GitHub.PullRequestReviewPageSize)
	requireEnvInt(t, env, "GITHUB_COMMIT_SYNC_PAGE_SIZE", cfg.GitHub.CommitSyncPageSize)
	requireEnvInt(t, env, "GITHUB_USER_REPOSITORY_SYNC_LIMIT", cfg.GitHub.UserRepositorySyncLimit)
	requireEnvInt(t, env, "GITHUB_INSTALLATION_REPOSITORY_PAGE_SIZE", cfg.GitHub.InstallationRepositoryPageSize)
	requireEnvInt(t, env, "GITHUB_INSTALLATION_REPOSITORY_MAX_PAGES", cfg.GitHub.InstallationRepositoryMaxPages)
	requireEnvInt(t, env, "GITHUB_AUTHORED_PR_SEARCH_LIMIT", cfg.GitHub.AuthoredPRSearchLimit)
	requireEnvInt(t, env, "GITHUB_AUTHORED_PR_SYNC_LIMIT", cfg.GitHub.AuthoredPRSyncLimit)
	requireEnvInt(t, env, "GITHUB_SYNC_RUN_DEFAULT_LIMIT", cfg.GitHub.SyncRunDefaultLimit)
	requireEnvInt(t, env, "GITHUB_SYNC_RUN_MAX_LIMIT", cfg.GitHub.SyncRunMaxLimit)
	requireEnvDuration(t, env, "GITHUB_USER_PR_SYNC_TIMEOUT_DEFAULT", cfg.GitHub.UserPRSyncTimeoutDefault)
	requireEnvDuration(t, env, "GITHUB_USER_PR_SYNC_TIMEOUT_MIN", cfg.GitHub.UserPRSyncTimeoutMin)
	requireEnvDuration(t, env, "GITHUB_USER_PR_SYNC_TIMEOUT_MAX", cfg.GitHub.UserPRSyncTimeoutMax)
	requireEnvInt(t, env, "GITHUB_WEBHOOK_MAX_BODY_BYTES", cfg.GitHub.MaxBodyBytes)
	requireEnvDuration(t, env, "GITHUB_WEBHOOK_DEDUPE_TTL", cfg.GitHub.DedupeTTL)
	requireEnvDuration(t, env, "GITHUB_FAILED_DELIVERY_LOOKBACK", cfg.GitHub.FailedLookback)
	requireEnvDuration(t, env, "GITHUB_INSTALLATION_REFRESH_SKEW", cfg.GitHub.RefreshSkew)
	requireEnvDuration(t, env, "GITHUB_SECONDARY_RATE_LIMIT_BACKOFF", cfg.GitHub.SecondaryBackoff)
	requireEnvDuration(t, env, "GITHUB_REPOSITORY_CACHE_TTL", cfg.GitHub.RepositoryCacheTTL)
	requireEnvInt(t, env, "GITHUB_MAX_CONCURRENT_REQUESTS", cfg.GitHub.MaxConcurrency)
	requireEnvInt(t, env, "GITHUB_CIRCUIT_BREAKER_FAILURE_THRESHOLD", cfg.GitHub.CircuitBreakerFailureThreshold)
	requireEnvDuration(t, env, "GITHUB_CIRCUIT_BREAKER_OPEN_INTERVAL", cfg.GitHub.CircuitBreakerOpenInterval)
	requireEnvInt(t, env, "GITHUB_CIRCUIT_BREAKER_HALF_OPEN_MAX_REQUESTS", cfg.GitHub.CircuitBreakerHalfOpenMax)

	requireEnvString(t, env, "AI_PROVIDER", cfg.AI.Provider)
	requireEnvString(t, env, "OPENAI_MODEL", cfg.AI.Model)
	requireEnvString(t, env, "OPENAI_BASE_URL", cfg.AI.BaseURL)
	requireEnvDuration(t, env, "AI_REQUEST_TIMEOUT", cfg.AI.RequestTimeout)
	requireEnvInt(t, env, "AI_SUMMARY_MAX_RUNES", cfg.AI.SummaryMaxRunes)
	requireEnvInt(t, env, "AI_SUMMARY_PROMPT_FILE_PATH_LIMIT", cfg.AI.SummaryPromptFilePathLimit)
	requireEnvInt(t, env, "AI_PR_MAX_CHANGED_FILES", cfg.AI.PRMaxChangedFiles)
	requireEnvInt(t, env, "AI_PR_MAX_FILE_RECORDS", cfg.AI.PRMaxFileRecords)
	requireEnvInt(t, env, "AI_PR_MAX_DIFF_LINES", cfg.AI.PRMaxDiffLines)
	requireEnvInt(t, env, "AI_PR_MAX_INPUT_CHARS", cfg.AI.PRMaxInputChars)
	requireEnvInt(t, env, "AI_PR_MAX_ESTIMATED_TOKENS", cfg.AI.PRMaxEstimatedTokens)

	requireEnvString(t, env, "SCHEDULER_RUN_MODE", cfg.Scheduler.RunMode)
	requireEnvString(t, env, "SCHEDULER_SYNC_CRON", cfg.Scheduler.SyncCron)
	requireEnvInt(t, env, "JOB_MAX_ATTEMPTS", cfg.Scheduler.MaxAttempts)
	requireEnvDuration(t, env, "JOB_RETRY_BACKOFF", cfg.Scheduler.RetryBackoff)
	requireEnvInt(t, env, "JOB_WORKER_CONCURRENCY", cfg.Scheduler.WorkerConcurrency)
	requireEnvDuration(t, env, "JOB_LEASE_TTL", cfg.Scheduler.LeaseTTL)
	requireEnvDuration(t, env, "JOB_POLL_INTERVAL", cfg.Scheduler.PollInterval)
	requireEnvString(t, env, "JOB_DEAD_LETTER_QUEUE", cfg.Scheduler.DeadLetterQueue)
	requireEnvDuration(t, env, "JOB_PER_USER_RATE_WINDOW", cfg.Scheduler.PerUserRateWindow)
	requireEnvInt(t, env, "JOB_PER_USER_RATE_MAX", cfg.Scheduler.PerUserRateMax)
	requireEnvDuration(t, env, "JOB_PER_INSTALLATION_RATE_WINDOW", cfg.Scheduler.PerInstallationRateWindow)
	requireEnvInt(t, env, "JOB_PER_INSTALLATION_RATE_MAX", cfg.Scheduler.PerInstallationRateMax)
}

func TestLoadDefaultsByServiceAddressKey(t *testing.T) {
	cases := []struct {
		serviceName string
		addrEnvKey  string
		want        string
	}{
		{serviceName: "api-gateway", addrEnvKey: "API_GATEWAY_ADDR", want: ":8080"},
		{serviceName: "auth-service", addrEnvKey: "AUTH_SERVICE_ADDR", want: ":8081"},
		{serviceName: "github-ingestor", addrEnvKey: "GITHUB_INGESTOR_ADDR", want: ":8082"},
		{serviceName: "pr-analyzer", addrEnvKey: "PR_ANALYZER_ADDR", want: ":8083"},
		{serviceName: "profile-service", addrEnvKey: "PROFILE_SERVICE_ADDR", want: ":8084"},
		{serviceName: "scoring-engine", addrEnvKey: "SCORING_ENGINE_ADDR", want: ":8085"},
		{serviceName: "scheduler-worker", addrEnvKey: "SCHEDULER_WORKER_ADDR", want: ":8086"},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.addrEnvKey, func(t *testing.T) {
			cfg, err := Load(tc.serviceName, tc.addrEnvKey)
			if err != nil {
				t.Fatalf("Load() error = %v", err)
			}
			if cfg.Addr != tc.want {
				t.Fatalf("Addr = %q, want %q", cfg.Addr, tc.want)
			}
		})
	}
}

func TestLoadTreatsBlankEnvValuesAsUnset(t *testing.T) {
	t.Setenv("GITRANK_PUBLIC_BASE_URL", "   ")
	t.Setenv("GITRANK_API_BASE_URL", "")
	t.Setenv("GITRANK_SERVICE_NAME", "   ")
	t.Setenv("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "   ")
	t.Setenv("GITHUB_REQUEST_TIMEOUT", "")

	cfg, err := Load("api-gateway", "API_GATEWAY_ADDR")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.PublicBaseURL != "http://localhost:3000" {
		t.Fatalf("PublicBaseURL = %q, want default http://localhost:3000", cfg.PublicBaseURL)
	}
	if cfg.APIBaseURL != "http://localhost:8080" {
		t.Fatalf("APIBaseURL = %q, want default http://localhost:8080", cfg.APIBaseURL)
	}
	if cfg.ServiceName != "api-gateway" {
		t.Fatalf("ServiceName = %q, want service fallback api-gateway", cfg.ServiceName)
	}
	if cfg.Auth.RateLimitMaxAttempts != 30 {
		t.Fatalf("Auth.RateLimitMaxAttempts = %d, want default 30", cfg.Auth.RateLimitMaxAttempts)
	}
	if cfg.GitHub.RequestTimeout != 20*time.Second {
		t.Fatalf("GitHub.RequestTimeout = %v, want default 20s", cfg.GitHub.RequestTimeout)
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
	t.Setenv("GITHUB_INSTALLATION_REPOSITORY_PAGE_SIZE", "60")
	t.Setenv("GITHUB_INSTALLATION_REPOSITORY_MAX_PAGES", "14")
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
	t.Setenv("AI_SUMMARY_MAX_RUNES", "500")
	t.Setenv("AI_SUMMARY_PROMPT_FILE_PATH_LIMIT", "18")
	t.Setenv("AI_ANALYZER_POLICY_JSON", `{"small_change_max_files":4}`)
	t.Setenv("AI_PR_MAX_INPUT_CHARS", "16000")
	t.Setenv("AI_PR_MAX_ESTIMATED_TOKENS", "4000")
	t.Setenv("AI_PR_MAX_ESTIMATED_COST_USD", "0.08")
	t.Setenv("AI_ESTIMATED_INPUT_TOKEN_COST_USD", "0.00001")
	t.Setenv("SCORING_SCORE_VERSION", "v1beta2")
	t.Setenv("SCORING_BASE_XP", "130")
	t.Setenv("SCORING_MIN_XP", "15")
	t.Setenv("SCORING_RANK_TIER_SILVER_MIN_XP", "1200")
	t.Setenv("SCORING_RANK_TIER_GOLD_MIN_XP", "3200")
	t.Setenv("SCORING_RANK_TIER_PLATINUM_MIN_XP", "7600")
	t.Setenv("SCORING_RANK_TIER_DIAMOND_MIN_XP", "12000")
	t.Setenv("SCORING_RANK_TIER_BRONZE_LABEL", "Bronze I")
	t.Setenv("SCORING_RANK_TIER_SILVER_LABEL", "Silver II")
	t.Setenv("SCORING_RANK_TIER_GOLD_LABEL", "Gold III")
	t.Setenv("SCORING_RANK_TIER_PLATINUM_LABEL", "Platinum I")
	t.Setenv("SCORING_RANK_TIER_DIAMOND_LABEL", "Diamond")
	t.Setenv("SCORING_LEADERBOARD_PROMOTION_RULE", "Top 20 move toward promotion review.")
	t.Setenv("SCORING_LEADERBOARD_RESET_RULE", "Weekly XP resets; total XP remains.")
	t.Setenv("SCORING_LEADERBOARD_PROMOTION_CUTOFF_RANK", "20")
	t.Setenv("SCORING_LEADERBOARD_SAFETY_CUTOFF_RANK", "70")
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
	if cfg.GitHub.InstallationRepositoryPageSize != 60 {
		t.Fatalf("GitHub.InstallationRepositoryPageSize = %d, want 60", cfg.GitHub.InstallationRepositoryPageSize)
	}
	if cfg.GitHub.InstallationRepositoryMaxPages != 14 {
		t.Fatalf("GitHub.InstallationRepositoryMaxPages = %d, want 14", cfg.GitHub.InstallationRepositoryMaxPages)
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
	if cfg.AI.SummaryMaxRunes != 500 || cfg.AI.SummaryPromptFilePathLimit != 18 {
		t.Fatalf("AI summary limits = runes %d prompt_paths %d, want 500/18", cfg.AI.SummaryMaxRunes, cfg.AI.SummaryPromptFilePathLimit)
	}
	if cfg.AI.AnalyzerPolicyJSON != `{"small_change_max_files":4}` {
		t.Fatalf("AI.AnalyzerPolicyJSON = %q, want override payload", cfg.AI.AnalyzerPolicyJSON)
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
	if cfg.Scoring.RankTierSilverMinXP != 1200 || cfg.Scoring.RankTierGoldMinXP != 3200 ||
		cfg.Scoring.RankTierPlatinumMinXP != 7600 || cfg.Scoring.RankTierDiamondMinXP != 12000 {
		t.Fatalf(
			"Scoring rank tier thresholds = %d/%d/%d/%d, want 1200/3200/7600/12000",
			cfg.Scoring.RankTierSilverMinXP,
			cfg.Scoring.RankTierGoldMinXP,
			cfg.Scoring.RankTierPlatinumMinXP,
			cfg.Scoring.RankTierDiamondMinXP,
		)
	}
	if cfg.Scoring.LeaderboardPromotionRule != "Top 20 move toward promotion review." ||
		cfg.Scoring.LeaderboardResetRule != "Weekly XP resets; total XP remains." {
		t.Fatalf("Scoring leaderboard rules override mismatch: %+v / %+v", cfg.Scoring.LeaderboardPromotionRule, cfg.Scoring.LeaderboardResetRule)
	}
	if cfg.Scoring.LeaderboardPromotionCutoffRank != 20 || cfg.Scoring.LeaderboardSafetyCutoffRank != 70 {
		t.Fatalf("Scoring leaderboard cutoffs override mismatch: %d/%d", cfg.Scoring.LeaderboardPromotionCutoffRank, cfg.Scoring.LeaderboardSafetyCutoffRank)
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

	if err := cfg.ValidateOAuth(); err != nil {
		t.Fatalf("ValidateOAuth() error = %v, want nil defaults", err)
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

func TestValidatePRAnalyzerServiceAllowsLocalDatabaseFallback(t *testing.T) {
	cfg, err := Load("pr-analyzer", "PR_ANALYZER_ADDR")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Database.URL != defaultLocalDatabaseURL {
		t.Fatalf("Database.URL = %q, want %q", cfg.Database.URL, defaultLocalDatabaseURL)
	}
	if err := cfg.ValidatePRAnalyzerService(); err != nil {
		t.Fatalf("ValidatePRAnalyzerService() error = %v, want nil with local fallback", err)
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

func TestScoringRankTierForXPUsesConfiguredThresholds(t *testing.T) {
	policy := Scoring{
		RankTierBronzeLabel:   "Bronze I",
		RankTierSilverLabel:   "Silver II",
		RankTierGoldLabel:     "Gold III",
		RankTierPlatinumLabel: "Platinum I",
		RankTierDiamondLabel:  "Diamond",
		RankTierSilverMinXP:   1200,
		RankTierGoldMinXP:     3200,
		RankTierPlatinumMinXP: 7600,
		RankTierDiamondMinXP:  12000,
	}

	cases := []struct {
		xp   int
		want string
	}{
		{xp: 0, want: "Bronze I"},
		{xp: 1199, want: "Bronze I"},
		{xp: 1200, want: "Silver II"},
		{xp: 3200, want: "Gold III"},
		{xp: 7600, want: "Platinum I"},
		{xp: 12000, want: "Diamond"},
	}
	for _, tc := range cases {
		if got := policy.RankTierForXP(tc.xp); got != tc.want {
			t.Fatalf("RankTierForXP(%d) = %q, want %q", tc.xp, got, tc.want)
		}
	}
}
