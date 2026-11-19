package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"
)

type Environment string

const (
	Development Environment = "development"
	Staging     Environment = "staging"
	Production  Environment = "production"

	maxGitHubAPIRuntimeConcurrency = 100
)

const (
	defaultLocalDatabaseURL      = "postgres://localhost:55432/gitrank?sslmode=disable"
	defaultLocalRedisURL         = "redis://localhost:6379/0"
	defaultDevSessionSecret      = "dev-insecure-session-secret-change-me"
	defaultDevJWTSigningKey      = "dev-insecure-jwt-signing-key-change-me"
	defaultDevGitHubClientID     = "dev-github-client-id"
	defaultDevGitHubClientSecret = "dev-github-client-secret"
	defaultDevTokenEncryptionKey = "Z2l0cmFuay1kZXYtdG9rZW4ta2V5LTMyYnl0ZXMhISE="
	defaultLocalOAuthRedirectURL = "http://localhost:3000/oauth/github/callback"
	defaultGitHubAppID           = "0"
	defaultGitHubAppSlug         = "replace-me"
	defaultGitHubAppClientID     = "replace-me"
	defaultGitHubAppClientSecret = "replace-me"
	defaultGitHubAppPrivateKey   = "./secrets/github-app-private-key.pem"
	defaultGitHubWebhookSecret   = "replace-me"
)

type App struct {
	Env             Environment
	ServiceName     string
	PublicBaseURL   string
	APIBaseURL      string
	Addr            string
	ShutdownTimeout time.Duration
	Log             Log
	Services        Services
	Database        Database
	Redis           Redis
	Auth            Auth
	GitHub          GitHub
	AI              AI
	Scoring         Scoring
	Profile         Profile
	Observability   Observability
	Scheduler       Scheduler
}

type Log struct {
	Level  string
	Format string
}

type Services struct {
	AuthBaseURL           string
	GitHubIngestorBaseURL string
	PRAnalyzerBaseURL     string
	ProfileBaseURL        string
	ScoringBaseURL        string
	SchedulerBaseURL      string
	RequestTimeout        time.Duration
}

type Database struct {
	URL string
}

type Redis struct {
	URL string
}

type Auth struct {
	SessionSecret               string
	PreviousSessionSecrets      []string
	JWTSigningKey               string
	SessionCookieName           string
	CSRFCookieName              string
	SessionCookieDomain         string
	SessionCookieSecure         bool
	SessionCookieSameSite       string
	SessionTTL                  time.Duration
	SessionIdleTTL              time.Duration
	SessionRotationInterval     time.Duration
	OAuthStateTTL               time.Duration
	TokenEncryptionKey          string
	PreviousTokenEncryptionKeys []string
	AdminGitHubLogins           []string
	MaintainerGitHubLogins      []string
	RateLimitWindow             time.Duration
	RateLimitMaxAttempts        int
}

type GitHub struct {
	ClientID                       string
	ClientSecret                   string
	AuthorizeURL                   string
	TokenURL                       string
	OAuthRedirectURL               string
	AppID                          string
	AppSlug                        string
	AppInstallURL                  string
	AppClientID                    string
	AppClientSecret                string
	AppPrivateKeyPEM               string
	WebhookSecret                  string
	APIBaseURL                     string
	GraphQLURL                     string
	APIVersion                     string
	UserAgent                      string
	OAuthScopes                    []string
	RequestTimeout                 time.Duration
	MaxPageSize                    int
	GraphQLPageSize                int
	RepositorySyncPageSize         int
	PullRequestReviewPageSize      int
	CommitSyncPageSize             int
	UserRepositorySyncLimit        int
	InstallationRepositoryPageSize int
	InstallationRepositoryMaxPages int
	AuthoredPRSearchLimit          int
	AuthoredPRSyncLimit            int
	SyncRunDefaultLimit            int
	SyncRunMaxLimit                int
	UserPRSyncTimeoutDefault       time.Duration
	UserPRSyncTimeoutMin           time.Duration
	UserPRSyncTimeoutMax           time.Duration
	MaxBodyBytes                   int
	DedupeTTL                      time.Duration
	RefreshSkew                    time.Duration
	SecondaryBackoff               time.Duration
	RepositoryCacheTTL             time.Duration
	MaxConcurrency                 int
	CircuitBreakerFailureThreshold int
	CircuitBreakerOpenInterval     time.Duration
	CircuitBreakerHalfOpenMax      int
}

type AI struct {
	Provider                   string
	APIKey                     string
	Model                      string
	BaseURL                    string
	RequestTimeout             time.Duration
	PRMaxChangedFiles          int
	PRMaxFileRecords           int
	PRMaxDiffLines             int
	PRMaxInputChars            int
	PRMaxEstimatedTokens       int
	PRMaxEstimatedCostUSD      float64
	EstimatedInputTokenCostUSD float64
}

type Profile struct {
	PublicCacheTTL             time.Duration
	PrivateCacheTTL            time.Duration
	SnapshotStaleTTL           time.Duration
	RecentReportsDefaultLimit  int
	RecentReportsMaxLimit      int
	ReportBackfillDefaultLimit int
	ReportBackfillMaxLimit     int
	AccountExportAuditLimit    int
}

type Observability struct {
	Enabled           bool
	OTLPEndpoint      string
	ServiceNamespace  string
	MetricsEnabled    bool
	DistributedTraces bool
}

type Scheduler struct {
	RunMode                   string
	SyncCron                  string
	MaxAttempts               int
	RetryBackoff              time.Duration
	WorkerConcurrency         int
	LeaseTTL                  time.Duration
	PollInterval              time.Duration
	DeadLetterQueue           string
	PerUserRateWindow         time.Duration
	PerUserRateMax            int
	PerInstallationRateWindow time.Duration
	PerInstallationRateMax    int
}

func Load(serviceName, addrEnvKey string) (App, error) {
	if err := validateScoringEnvironment(); err != nil {
		return App{}, err
	}
	if strings.TrimSpace(os.Getenv("AI_ANALYZER_POLICY_JSON")) != "" {
		return App{}, errors.New("analyzer rules are compiled in the analyzer policy; remove AI_ANALYZER_POLICY_JSON")
	}
	rawAIProvider, aiProviderExplicit := lookupTrimmedEnv("AI_PROVIDER")
	aiProvider := resolveAIProvider(rawAIProvider, aiProviderExplicit)
	allowSecondaryAIEnv := !aiProviderExplicit
	aiAPIKey := resolveAIEnv(aiProvider, "API_KEY", "", allowSecondaryAIEnv)
	aiModel := resolveAIEnv(aiProvider, "MODEL", defaultAIModel(aiProvider), allowSecondaryAIEnv)
	aiBaseURL := resolveAIEnv(aiProvider, "BASE_URL", defaultAIBaseURL(aiProvider), allowSecondaryAIEnv)

	cfg := App{
		Env:             Environment(getEnv("GITRANK_ENV", string(Development))),
		ServiceName:     getEnv("GITRANK_SERVICE_NAME", serviceName),
		PublicBaseURL:   getEnv("GITRANK_PUBLIC_BASE_URL", "http://localhost:3000"),
		APIBaseURL:      getEnv("GITRANK_API_BASE_URL", "http://localhost:8080"),
		Addr:            getEnv(addrEnvKey, defaultServiceAddr(addrEnvKey)),
		ShutdownTimeout: getDuration("GITRANK_SHUTDOWN_TIMEOUT", 10*time.Second),
		Log: Log{
			Level:  getEnv("GITRANK_LOG_LEVEL", "info"),
			Format: getEnv("GITRANK_LOG_FORMAT", "text"),
		},
		Services: Services{
			AuthBaseURL:           getEnv("AUTH_SERVICE_BASE_URL", "http://localhost:8081"),
			GitHubIngestorBaseURL: getEnv("GITHUB_INGESTOR_BASE_URL", "http://localhost:8082"),
			PRAnalyzerBaseURL:     getEnv("PR_ANALYZER_BASE_URL", "http://localhost:8083"),
			ProfileBaseURL:        getEnv("PROFILE_SERVICE_BASE_URL", "http://localhost:8084"),
			ScoringBaseURL:        getEnv("SCORING_ENGINE_BASE_URL", "http://localhost:8085"),
			SchedulerBaseURL:      getEnv("SCHEDULER_WORKER_BASE_URL", "http://localhost:8086"),
			RequestTimeout:        getDuration("INTERNAL_API_REQUEST_TIMEOUT", 5*time.Second),
		},
		Database: Database{
			URL: getEnv("DATABASE_URL", defaultLocalDatabaseURL),
		},
		Redis: Redis{
			URL: getEnv("REDIS_URL", defaultLocalRedisURL),
		},
		Auth: Auth{
			SessionSecret:               getEnv("GITRANK_SESSION_SECRET", defaultDevSessionSecret),
			PreviousSessionSecrets:      getCSV("GITRANK_PREVIOUS_SESSION_SECRETS"),
			JWTSigningKey:               getEnv("GITRANK_JWT_SIGNING_KEY", defaultDevJWTSigningKey),
			SessionCookieName:           getEnv("AUTH_SESSION_COOKIE_NAME", "gitrank_session"),
			CSRFCookieName:              getEnv("AUTH_CSRF_COOKIE_NAME", "gitrank_csrf"),
			SessionCookieDomain:         getEnv("AUTH_COOKIE_DOMAIN", ""),
			SessionCookieSecure:         getBool("AUTH_COOKIE_SECURE", false),
			SessionCookieSameSite:       strings.ToLower(getEnv("AUTH_COOKIE_SAME_SITE", "lax")),
			SessionTTL:                  getDuration("AUTH_SESSION_TTL", 30*24*time.Hour),
			SessionIdleTTL:              getDuration("AUTH_SESSION_IDLE_TTL", 72*time.Hour),
			SessionRotationInterval:     getDuration("AUTH_SESSION_ROTATION_INTERVAL", 24*time.Hour),
			OAuthStateTTL:               getDuration("AUTH_OAUTH_STATE_TTL", 10*time.Minute),
			TokenEncryptionKey:          getEnv("GITHUB_TOKEN_ENCRYPTION_KEY", defaultDevTokenEncryptionKey),
			PreviousTokenEncryptionKeys: getCSV("GITHUB_PREVIOUS_TOKEN_ENCRYPTION_KEYS"),
			AdminGitHubLogins:           getCSV("AUTH_ADMIN_GITHUB_LOGINS"),
			MaintainerGitHubLogins:      getCSV("AUTH_MAINTAINER_GITHUB_LOGINS"),
			RateLimitWindow:             getDuration("AUTH_RATE_LIMIT_WINDOW", time.Minute),
			RateLimitMaxAttempts:        getInt("AUTH_RATE_LIMIT_MAX_ATTEMPTS", 30),
		},
		GitHub: GitHub{
			ClientID:                       getEnv("GITHUB_CLIENT_ID", defaultDevGitHubClientID),
			ClientSecret:                   getEnv("GITHUB_CLIENT_SECRET", defaultDevGitHubClientSecret),
			AuthorizeURL:                   getEnv("GITHUB_OAUTH_AUTHORIZE_URL", "https://github.com/login/oauth/authorize"),
			TokenURL:                       getEnv("GITHUB_OAUTH_EXCHANGE_URL", getEnv("GITHUB_OAUTH_TOKEN_URL", "https://github.com/login/oauth/access_token")),
			OAuthRedirectURL:               getEnv("GITHUB_OAUTH_REDIRECT_URL", defaultLocalOAuthRedirectURL),
			AppID:                          getEnv("GITHUB_APP_ID", defaultGitHubAppID),
			AppSlug:                        getEnv("GITHUB_APP_SLUG", defaultGitHubAppSlug),
			AppInstallURL:                  getEnv("GITHUB_APP_INSTALL_URL", ""),
			AppClientID:                    getEnv("GITHUB_APP_CLIENT_ID", defaultGitHubAppClientID),
			AppClientSecret:                getEnv("GITHUB_APP_CLIENT_SECRET", defaultGitHubAppClientSecret),
			AppPrivateKeyPEM:               getEnv("GITHUB_APP_PRIVATE_KEY_PEM_PATH", defaultGitHubAppPrivateKey),
			WebhookSecret:                  getEnv("GITHUB_WEBHOOK_SECRET", defaultGitHubWebhookSecret),
			APIBaseURL:                     getEnv("GITHUB_API_BASE_URL", "https://api.github.com"),
			GraphQLURL:                     getEnv("GITHUB_GRAPHQL_URL", "https://api.github.com/graphql"),
			APIVersion:                     getEnv("GITHUB_API_VERSION", "2026-03-10"),
			UserAgent:                      getEnv("GITHUB_USER_AGENT", "GitRank/dev"),
			OAuthScopes:                    getCSVWithDefault("GITHUB_OAUTH_SCOPES", []string{"read:user", "user:email"}),
			RequestTimeout:                 getDuration("GITHUB_REQUEST_TIMEOUT", 20*time.Second),
			MaxPageSize:                    getInt("GITHUB_MAX_PAGE_SIZE", 100),
			GraphQLPageSize:                getInt("GITHUB_GRAPHQL_PAGE_SIZE", 100),
			RepositorySyncPageSize:         getInt("GITHUB_REPOSITORY_SYNC_PAGE_SIZE", 10),
			PullRequestReviewPageSize:      getInt("GITHUB_PULL_REQUEST_REVIEW_PAGE_SIZE", 10),
			CommitSyncPageSize:             getInt("GITHUB_COMMIT_SYNC_PAGE_SIZE", 50),
			UserRepositorySyncLimit:        getInt("GITHUB_USER_REPOSITORY_SYNC_LIMIT", 100),
			InstallationRepositoryPageSize: getInt("GITHUB_INSTALLATION_REPOSITORY_PAGE_SIZE", 50),
			InstallationRepositoryMaxPages: getInt("GITHUB_INSTALLATION_REPOSITORY_MAX_PAGES", 10),
			AuthoredPRSearchLimit:          getInt("GITHUB_AUTHORED_PR_SEARCH_LIMIT", 100),
			AuthoredPRSyncLimit:            getInt("GITHUB_AUTHORED_PR_SYNC_LIMIT", 25),
			SyncRunDefaultLimit:            getInt("GITHUB_SYNC_RUN_DEFAULT_LIMIT", 50),
			SyncRunMaxLimit:                getInt("GITHUB_SYNC_RUN_MAX_LIMIT", 200),
			UserPRSyncTimeoutDefault:       getDuration("GITHUB_USER_PR_SYNC_TIMEOUT_DEFAULT", 45*time.Second),
			UserPRSyncTimeoutMin:           getDuration("GITHUB_USER_PR_SYNC_TIMEOUT_MIN", 20*time.Second),
			UserPRSyncTimeoutMax:           getDuration("GITHUB_USER_PR_SYNC_TIMEOUT_MAX", 90*time.Second),
			MaxBodyBytes:                   getInt("GITHUB_WEBHOOK_MAX_BODY_BYTES", 1<<20),
			DedupeTTL:                      getDuration("GITHUB_WEBHOOK_DEDUPE_TTL", 7*24*time.Hour),
			RefreshSkew:                    getDuration("GITHUB_INSTALLATION_REFRESH_SKEW", getDuration("GITHUB_INSTALLATION_TOKEN_REFRESH_SKEW", 5*time.Minute)),
			SecondaryBackoff:               getDuration("GITHUB_SECONDARY_RATE_LIMIT_BACKOFF", time.Minute),
			RepositoryCacheTTL:             getDuration("GITHUB_REPOSITORY_CACHE_TTL", 10*time.Minute),
			MaxConcurrency:                 getInt("GITHUB_MAX_CONCURRENT_REQUESTS", 8),
			CircuitBreakerFailureThreshold: getInt("GITHUB_CIRCUIT_BREAKER_FAILURE_THRESHOLD", 5),
			CircuitBreakerOpenInterval:     getDuration("GITHUB_CIRCUIT_BREAKER_OPEN_INTERVAL", 30*time.Second),
			CircuitBreakerHalfOpenMax:      getInt("GITHUB_CIRCUIT_BREAKER_HALF_OPEN_MAX_REQUESTS", 1),
		},
		AI: AI{
			Provider:                   aiProvider,
			APIKey:                     aiAPIKey,
			Model:                      aiModel,
			BaseURL:                    aiBaseURL,
			RequestTimeout:             getDuration("AI_REQUEST_TIMEOUT", 20*time.Second),
			PRMaxChangedFiles:          getInt("AI_PR_MAX_CHANGED_FILES", 100),
			PRMaxFileRecords:           getInt("AI_PR_MAX_FILE_RECORDS", 100),
			PRMaxDiffLines:             getInt("AI_PR_MAX_DIFF_LINES", 5000),
			PRMaxInputChars:            getInt("AI_PR_MAX_INPUT_CHARS", 120000),
			PRMaxEstimatedTokens:       getInt("AI_PR_MAX_ESTIMATED_TOKENS", 30000),
			PRMaxEstimatedCostUSD:      getFloat("AI_PR_MAX_ESTIMATED_COST_USD", 0.25),
			EstimatedInputTokenCostUSD: getFloat("AI_ESTIMATED_INPUT_TOKEN_COST_USD", 0.000005),
		},
		Scoring: loadScoringPolicy(),
		Profile: Profile{
			PublicCacheTTL:             getDuration("PROFILE_PUBLIC_CACHE_TTL", 5*time.Minute),
			PrivateCacheTTL:            getDuration("PROFILE_PRIVATE_CACHE_TTL", 2*time.Minute),
			SnapshotStaleTTL:           getDuration("PROFILE_SNAPSHOT_STALE_TTL", 15*time.Minute),
			RecentReportsDefaultLimit:  getInt("PROFILE_RECENT_REPORTS_DEFAULT_LIMIT", 4),
			RecentReportsMaxLimit:      getInt("PROFILE_RECENT_REPORTS_MAX_LIMIT", 10),
			ReportBackfillDefaultLimit: getInt("PROFILE_REPORT_BACKFILL_DEFAULT_LIMIT", 50),
			ReportBackfillMaxLimit:     getInt("PROFILE_REPORT_BACKFILL_MAX_LIMIT", 200),
			AccountExportAuditLimit:    getInt("PROFILE_ACCOUNT_EXPORT_AUDIT_LIMIT", 200),
		},
		Observability: Observability{
			Enabled:           getBool("OTEL_ENABLED", false),
			OTLPEndpoint:      getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318"),
			ServiceNamespace:  getEnv("OTEL_SERVICE_NAMESPACE", "gitrank"),
			MetricsEnabled:    getBool("OTEL_METRICS_ENABLED", true),
			DistributedTraces: getBool("OTEL_TRACES_ENABLED", true),
		},
		Scheduler: Scheduler{
			RunMode:                   strings.ToLower(getEnv("SCHEDULER_RUN_MODE", "combined")),
			SyncCron:                  getEnv("SCHEDULER_SYNC_CRON", "0 */6 * * *"),
			MaxAttempts:               getInt("JOB_MAX_ATTEMPTS", 10),
			RetryBackoff:              getDuration("JOB_RETRY_BACKOFF", 30*time.Second),
			WorkerConcurrency:         getInt("JOB_WORKER_CONCURRENCY", 4),
			LeaseTTL:                  getDuration("JOB_LEASE_TTL", 2*time.Minute),
			PollInterval:              getDuration("JOB_POLL_INTERVAL", 5*time.Second),
			DeadLetterQueue:           getEnv("JOB_DEAD_LETTER_QUEUE", "github-sync-dead-letter"),
			PerUserRateWindow:         getDuration("JOB_PER_USER_RATE_WINDOW", 15*time.Minute),
			PerUserRateMax:            getInt("JOB_PER_USER_RATE_MAX", 6),
			PerInstallationRateWindow: getDuration("JOB_PER_INSTALLATION_RATE_WINDOW", 15*time.Minute),
			PerInstallationRateMax:    getInt("JOB_PER_INSTALLATION_RATE_MAX", 18),
		},
	}

	return cfg, cfg.ValidateBase()
}

func (a App) ValidateBase() error {
	var problems []string

	switch a.Env {
	case Development, Staging, Production:
	default:
		problems = append(problems, "GITRANK_ENV must be development, staging, or production")
	}

	if strings.TrimSpace(a.ServiceName) == "" {
		problems = append(problems, "service name is required")
	}
	if strings.TrimSpace(a.Addr) == "" {
		problems = append(problems, "listen address is required")
	}
	if a.ShutdownTimeout <= 0 {
		problems = append(problems, "shutdown timeout must be positive")
	}
	if err := validateURL(a.PublicBaseURL); err != nil {
		problems = append(problems, fmt.Sprintf("public base URL: %v", err))
	}
	if err := validateURL(a.APIBaseURL); err != nil {
		problems = append(problems, fmt.Sprintf("API base URL: %v", err))
	}
	internalURLs := map[string]string{
		"AUTH_SERVICE_BASE_URL":      a.Services.AuthBaseURL,
		"GITHUB_INGESTOR_BASE_URL":   a.Services.GitHubIngestorBaseURL,
		"PR_ANALYZER_BASE_URL":       a.Services.PRAnalyzerBaseURL,
		"PROFILE_SERVICE_BASE_URL":   a.Services.ProfileBaseURL,
		"SCORING_ENGINE_BASE_URL":    a.Services.ScoringBaseURL,
		"SCHEDULER_WORKER_BASE_URL":  a.Services.SchedulerBaseURL,
		"GITHUB_OAUTH_AUTHORIZE_URL": a.GitHub.AuthorizeURL,
		"GITHUB_OAUTH_EXCHANGE_URL":  a.GitHub.TokenURL,
	}
	for name, value := range internalURLs {
		if err := validateURL(value); err != nil {
			problems = append(problems, fmt.Sprintf("%s: %v", name, err))
		}
	}
	if err := validateURL(a.GitHub.APIBaseURL); err != nil {
		problems = append(problems, fmt.Sprintf("GitHub API base URL: %v", err))
	}
	if err := validateURL(a.GitHub.GraphQLURL); err != nil {
		problems = append(problems, fmt.Sprintf("GitHub GraphQL URL: %v", err))
	}
	if err := validateURL(a.AI.BaseURL); err != nil {
		problems = append(problems, fmt.Sprintf("AI base URL: %v", err))
	}
	if strings.TrimSpace(a.GitHub.OAuthRedirectURL) != "" {
		if err := validateURL(a.GitHub.OAuthRedirectURL); err != nil {
			problems = append(problems, fmt.Sprintf("GITHUB_OAUTH_REDIRECT_URL: %v", err))
		}
	}
	if strings.TrimSpace(a.GitHub.AppInstallURL) != "" {
		if err := validateURL(a.GitHub.AppInstallURL); err != nil {
			problems = append(problems, fmt.Sprintf("GITHUB_APP_INSTALL_URL: %v", err))
		}
	}
	if a.Scheduler.MaxAttempts <= 0 {
		problems = append(problems, "JOB_MAX_ATTEMPTS must be positive")
	}
	switch a.Scheduler.RunMode {
	case "combined", "api", "worker":
	default:
		problems = append(problems, "SCHEDULER_RUN_MODE must be combined, api, or worker")
	}
	if a.Scheduler.RetryBackoff <= 0 {
		problems = append(problems, "JOB_RETRY_BACKOFF must be positive")
	}
	if a.Services.RequestTimeout <= 0 {
		problems = append(problems, "INTERNAL_API_REQUEST_TIMEOUT must be positive")
	}
	if a.GitHub.RequestTimeout <= 0 {
		problems = append(problems, "GITHUB_REQUEST_TIMEOUT must be positive")
	}
	if a.GitHub.MaxPageSize <= 0 || a.GitHub.MaxPageSize > 100 {
		problems = append(problems, "GITHUB_MAX_PAGE_SIZE must be between 1 and 100")
	}
	if a.GitHub.GraphQLPageSize <= 0 || a.GitHub.GraphQLPageSize > 100 {
		problems = append(problems, "GITHUB_GRAPHQL_PAGE_SIZE must be between 1 and 100")
	}
	if a.GitHub.RepositorySyncPageSize <= 0 || a.GitHub.RepositorySyncPageSize > 100 {
		problems = append(problems, "GITHUB_REPOSITORY_SYNC_PAGE_SIZE must be between 1 and 100")
	}
	if a.GitHub.PullRequestReviewPageSize <= 0 || a.GitHub.PullRequestReviewPageSize > 100 {
		problems = append(problems, "GITHUB_PULL_REQUEST_REVIEW_PAGE_SIZE must be between 1 and 100")
	}
	if a.GitHub.CommitSyncPageSize <= 0 || a.GitHub.CommitSyncPageSize > 100 {
		problems = append(problems, "GITHUB_COMMIT_SYNC_PAGE_SIZE must be between 1 and 100")
	}
	if a.GitHub.UserRepositorySyncLimit <= 0 || a.GitHub.UserRepositorySyncLimit > 500 {
		problems = append(problems, "GITHUB_USER_REPOSITORY_SYNC_LIMIT must be between 1 and 500")
	}
	if a.GitHub.InstallationRepositoryPageSize <= 0 || a.GitHub.InstallationRepositoryPageSize > 100 {
		problems = append(problems, "GITHUB_INSTALLATION_REPOSITORY_PAGE_SIZE must be between 1 and 100")
	}
	if a.GitHub.InstallationRepositoryMaxPages <= 0 || a.GitHub.InstallationRepositoryMaxPages > 200 {
		problems = append(problems, "GITHUB_INSTALLATION_REPOSITORY_MAX_PAGES must be between 1 and 200")
	}
	if a.GitHub.AuthoredPRSearchLimit <= 0 || a.GitHub.AuthoredPRSearchLimit > 100 {
		problems = append(problems, "GITHUB_AUTHORED_PR_SEARCH_LIMIT must be between 1 and 100")
	}
	if a.GitHub.AuthoredPRSyncLimit <= 0 || a.GitHub.AuthoredPRSyncLimit > a.GitHub.AuthoredPRSearchLimit {
		problems = append(problems, "GITHUB_AUTHORED_PR_SYNC_LIMIT must be between 1 and GITHUB_AUTHORED_PR_SEARCH_LIMIT")
	}
	if a.GitHub.SyncRunDefaultLimit <= 0 || a.GitHub.SyncRunMaxLimit <= 0 {
		problems = append(problems, "GITHUB_SYNC_RUN_DEFAULT_LIMIT and GITHUB_SYNC_RUN_MAX_LIMIT must be positive")
	}
	if a.GitHub.SyncRunMaxLimit < a.GitHub.SyncRunDefaultLimit {
		problems = append(problems, "GITHUB_SYNC_RUN_MAX_LIMIT must be >= GITHUB_SYNC_RUN_DEFAULT_LIMIT")
	}
	if a.GitHub.UserPRSyncTimeoutDefault <= 0 {
		problems = append(problems, "GITHUB_USER_PR_SYNC_TIMEOUT_DEFAULT must be positive")
	}
	if a.GitHub.UserPRSyncTimeoutMin <= 0 {
		problems = append(problems, "GITHUB_USER_PR_SYNC_TIMEOUT_MIN must be positive")
	}
	if a.GitHub.UserPRSyncTimeoutMax <= 0 {
		problems = append(problems, "GITHUB_USER_PR_SYNC_TIMEOUT_MAX must be positive")
	}
	if a.GitHub.UserPRSyncTimeoutMax < a.GitHub.UserPRSyncTimeoutMin {
		problems = append(problems, "GITHUB_USER_PR_SYNC_TIMEOUT_MAX must be greater than or equal to GITHUB_USER_PR_SYNC_TIMEOUT_MIN")
	}
	if a.GitHub.UserPRSyncTimeoutDefault < a.GitHub.UserPRSyncTimeoutMin || a.GitHub.UserPRSyncTimeoutDefault > a.GitHub.UserPRSyncTimeoutMax {
		problems = append(problems, "GITHUB_USER_PR_SYNC_TIMEOUT_DEFAULT must be between GITHUB_USER_PR_SYNC_TIMEOUT_MIN and GITHUB_USER_PR_SYNC_TIMEOUT_MAX")
	}
	if strings.TrimSpace(a.GitHub.APIVersion) == "" {
		problems = append(problems, "GITHUB_API_VERSION is required")
	}
	if strings.TrimSpace(a.GitHub.UserAgent) == "" {
		problems = append(problems, "GITHUB_USER_AGENT is required")
	}
	if len(a.GitHub.OAuthScopes) == 0 {
		problems = append(problems, "GITHUB_OAUTH_SCOPES must include at least one scope")
	}
	if a.GitHub.MaxBodyBytes <= 0 {
		problems = append(problems, "GITHUB_WEBHOOK_MAX_BODY_BYTES must be positive")
	}
	if a.GitHub.DedupeTTL <= 0 {
		problems = append(problems, "GITHUB_WEBHOOK_DEDUPE_TTL must be positive")
	}
	if a.GitHub.RefreshSkew <= 0 {
		problems = append(problems, "GITHUB_INSTALLATION_REFRESH_SKEW must be positive")
	}
	if a.GitHub.SecondaryBackoff <= 0 {
		problems = append(problems, "GITHUB_SECONDARY_RATE_LIMIT_BACKOFF must be positive")
	}
	if a.GitHub.RepositoryCacheTTL < 0 {
		problems = append(problems, "GITHUB_REPOSITORY_CACHE_TTL must not be negative")
	}
	if a.GitHub.MaxConcurrency <= 0 {
		problems = append(problems, "GITHUB_MAX_CONCURRENT_REQUESTS must be positive")
	} else if a.GitHub.MaxConcurrency > maxGitHubAPIRuntimeConcurrency {
		problems = append(problems, "GITHUB_MAX_CONCURRENT_REQUESTS must be <= 100")
	}
	if a.GitHub.CircuitBreakerFailureThreshold <= 0 {
		problems = append(problems, "GITHUB_CIRCUIT_BREAKER_FAILURE_THRESHOLD must be positive")
	}
	if a.GitHub.CircuitBreakerOpenInterval <= 0 {
		problems = append(problems, "GITHUB_CIRCUIT_BREAKER_OPEN_INTERVAL must be positive")
	}
	if a.GitHub.CircuitBreakerHalfOpenMax <= 0 {
		problems = append(problems, "GITHUB_CIRCUIT_BREAKER_HALF_OPEN_MAX_REQUESTS must be positive")
	}
	if a.AI.RequestTimeout <= 0 {
		problems = append(problems, "AI_REQUEST_TIMEOUT must be positive")
	}
	if a.AI.PRMaxChangedFiles <= 0 {
		problems = append(problems, "AI_PR_MAX_CHANGED_FILES must be positive")
	}
	if a.AI.PRMaxFileRecords <= 0 {
		problems = append(problems, "AI_PR_MAX_FILE_RECORDS must be positive")
	}
	if a.AI.PRMaxDiffLines <= 0 {
		problems = append(problems, "AI_PR_MAX_DIFF_LINES must be positive")
	}
	if a.AI.PRMaxInputChars <= 0 {
		problems = append(problems, "AI_PR_MAX_INPUT_CHARS must be positive")
	}
	if a.AI.PRMaxEstimatedTokens <= 0 {
		problems = append(problems, "AI_PR_MAX_ESTIMATED_TOKENS must be positive")
	}
	if a.AI.PRMaxEstimatedCostUSD <= 0 {
		problems = append(problems, "AI_PR_MAX_ESTIMATED_COST_USD must be positive")
	}
	if a.AI.EstimatedInputTokenCostUSD <= 0 {
		problems = append(problems, "AI_ESTIMATED_INPUT_TOKEN_COST_USD must be positive")
	}
	if strings.TrimSpace(a.Scoring.ScoreVersion) == "" {
		problems = append(problems, "scoring policy score version is required")
	}
	if a.Scoring.BaseXP <= 0 {
		problems = append(problems, "scoring policy base xp must be positive")
	}
	if a.Scoring.MinXP <= 0 {
		problems = append(problems, "scoring policy min xp must be positive")
	}
	if a.Scoring.LevelStepXP <= 0 {
		problems = append(problems, "scoring policy level step xp must be positive")
	}
	if a.Scoring.ProfileScoreHistoryLimit <= 0 {
		problems = append(problems, "SCORING_PROFILE_SCORE_HISTORY_LIMIT must be positive")
	}
	if strings.TrimSpace(a.Scoring.RankTierBronzeLabel) == "" ||
		strings.TrimSpace(a.Scoring.RankTierSilverLabel) == "" ||
		strings.TrimSpace(a.Scoring.RankTierGoldLabel) == "" ||
		strings.TrimSpace(a.Scoring.RankTierPlatinumLabel) == "" ||
		strings.TrimSpace(a.Scoring.RankTierDiamondLabel) == "" {
		problems = append(problems, "scoring policy rank tier * label values are required")
	}
	if a.Scoring.RankTierSilverMinXP <= 0 ||
		a.Scoring.RankTierGoldMinXP <= 0 ||
		a.Scoring.RankTierPlatinumMinXP <= 0 ||
		a.Scoring.RankTierDiamondMinXP <= 0 {
		problems = append(problems, "scoring policy rank tier * min xp values must be positive")
	}
	if !(a.Scoring.RankTierSilverMinXP < a.Scoring.RankTierGoldMinXP &&
		a.Scoring.RankTierGoldMinXP < a.Scoring.RankTierPlatinumMinXP &&
		a.Scoring.RankTierPlatinumMinXP < a.Scoring.RankTierDiamondMinXP) {
		problems = append(problems, "scoring policy rank tier * min xp values must be strictly increasing")
	}
	if strings.TrimSpace(a.Scoring.LeaderboardPromotionRule) == "" || strings.TrimSpace(a.Scoring.LeaderboardResetRule) == "" {
		problems = append(problems, "scoring policy leaderboard promotion rule and scoring policy leaderboard reset rule are required")
	}
	if a.Scoring.LeaderboardPromotionCutoffRank <= 0 || a.Scoring.LeaderboardSafetyCutoffRank <= 0 {
		problems = append(problems, "scoring policy leaderboard promotion cutoff rank and scoring policy leaderboard safety cutoff rank must be positive")
	}
	if a.Scoring.LeaderboardSafetyCutoffRank < a.Scoring.LeaderboardPromotionCutoffRank {
		problems = append(problems, "scoring policy leaderboard safety cutoff rank must be >= scoring policy leaderboard promotion cutoff rank")
	}
	if a.Scoring.LeaderboardDefaultLimit <= 0 || a.Scoring.LeaderboardMaxLimit <= 0 {
		problems = append(problems, "SCORING_LEADERBOARD_DEFAULT_LIMIT and SCORING_LEADERBOARD_MAX_LIMIT must be positive")
	}
	if a.Scoring.LeaderboardMaxLimit < a.Scoring.LeaderboardDefaultLimit {
		problems = append(problems, "SCORING_LEADERBOARD_MAX_LIMIT must be >= SCORING_LEADERBOARD_DEFAULT_LIMIT")
	}
	if a.Scoring.LeaderboardBackfillDefaultWeeks <= 0 || a.Scoring.LeaderboardBackfillMaxWeeks <= 0 {
		problems = append(problems, "SCORING_LEADERBOARD_BACKFILL_DEFAULT_WEEKS and SCORING_LEADERBOARD_BACKFILL_MAX_WEEKS must be positive")
	}
	if a.Scoring.LeaderboardBackfillMaxWeeks < a.Scoring.LeaderboardBackfillDefaultWeeks {
		problems = append(problems, "SCORING_LEADERBOARD_BACKFILL_MAX_WEEKS must be >= SCORING_LEADERBOARD_BACKFILL_DEFAULT_WEEKS")
	}
	if a.Scoring.HighXPThreshold <= 0 {
		problems = append(problems, "scoring policy high xp threshold must be positive")
	}
	if a.Scoring.CategoryWeightDefault <= 0 {
		problems = append(problems, "scoring policy category weight default must be positive")
	}
	if a.Scoring.CategoryWeightDocumentation <= 0 || a.Scoring.CategoryWeightTests <= 0 || a.Scoring.CategoryWeightBugFix <= 0 ||
		a.Scoring.CategoryWeightFeature <= 0 || a.Scoring.CategoryWeightRefactor <= 0 || a.Scoring.CategoryWeightPerformance <= 0 ||
		a.Scoring.CategoryWeightInfrastructure <= 0 || a.Scoring.CategoryWeightSecurity <= 0 || a.Scoring.CategoryWeightMaintainerDesign <= 0 {
		problems = append(problems, "all scoring policy category weight * values must be positive")
	}
	if a.Scoring.RepositoryMaintainersThreshold <= 0 {
		problems = append(problems, "scoring policy repository maintainers threshold must be positive")
	}
	if a.Scoring.RepositoryMaintainersBonus < 0 || a.Scoring.RepositoryStarsTierOneBonus < 0 || a.Scoring.RepositoryStarsTierTwoBonus < 0 {
		problems = append(problems, "scoring policy repository * bonus values must be non-negative")
	}
	if a.Scoring.RepositoryStarsTierOneThreshold <= 0 || a.Scoring.RepositoryStarsTierTwoThreshold <= 0 {
		problems = append(problems, "scoring policy repository stars * threshold values must be positive")
	}
	if a.Scoring.RepositoryStarsTierTwoThreshold < a.Scoring.RepositoryStarsTierOneThreshold {
		problems = append(problems, "scoring policy repository stars tier two threshold must be >= scoring policy repository stars tier one threshold")
	}
	if a.Scoring.RepositoryArchivedPenalty < 0 {
		problems = append(problems, "scoring policy repository archived penalty must be non-negative")
	}
	if a.Scoring.RepositoryWeightMin <= 0 || a.Scoring.RepositoryWeightMax <= 0 || a.Scoring.RepositoryWeightMax < a.Scoring.RepositoryWeightMin {
		problems = append(problems, "scoring policy repository weight min/max must be positive and MAX >= MIN")
	}
	if a.Scoring.OutcomeWeightMerged <= 0 || a.Scoring.OutcomeWeightDraft <= 0 || a.Scoring.OutcomeWeightClosed <= 0 || a.Scoring.OutcomeWeightOpen <= 0 {
		problems = append(problems, "scoring policy outcome weight * values must be positive")
	}
	if a.Scoring.ConsistencyActiveWeeksCap <= 0 {
		problems = append(problems, "scoring policy consistency active weeks cap must be positive")
	}
	if a.Scoring.ConsistencyActiveWeekBonus < 0 || a.Scoring.ConsistencyMeaningfulRatioBonus < 0 || a.Scoring.ConsistencyRecentMergedBonus < 0 {
		problems = append(problems, "scoring policy consistency * bonus values must be non-negative")
	}
	if a.Scoring.ConsistencyRecentMergedThreshold <= 0 {
		problems = append(problems, "scoring policy consistency recent merged threshold must be positive")
	}
	if a.Scoring.ConsistencyModifierMax <= 0 {
		problems = append(problems, "scoring policy consistency modifier max must be positive")
	}
	if a.Scoring.ReviewStrengthBase <= 0 || a.Scoring.ReviewStrengthCommentedBonus < 0 || a.Scoring.ReviewStrengthApprovedBonus < 0 ||
		a.Scoring.ReviewStrengthChangesBonus < 0 || a.Scoring.ReviewStrengthDenseBonus < 0 || a.Scoring.ReviewStrengthMax <= 0 {
		problems = append(problems, "scoring policy review strength * values must be positive, and *_BONUS values must be non-negative")
	}
	if a.Scoring.ReviewStrengthApprovedCap <= 0 || a.Scoring.ReviewStrengthChangesCap <= 0 || a.Scoring.ReviewStrengthDenseThreshold <= 0 {
		problems = append(problems, "scoring policy review strength * cap/threshold values must be positive")
	}
	if a.Scoring.ReviewStrengthMax < a.Scoring.ReviewStrengthBase {
		problems = append(problems, "scoring policy review strength max must be >= scoring policy review strength base")
	}
	if a.Scoring.TechnicalDepthBase <= 0 || a.Scoring.TechnicalDepthSourceBonus < 0 || a.Scoring.TechnicalDepthTestsBonus < 0 ||
		a.Scoring.TechnicalDepthInfraConfigBonus < 0 || a.Scoring.TechnicalDepthCrossSurfaceBonus < 0 ||
		a.Scoring.TechnicalDepthChangedFilesBonus < 0 || a.Scoring.TechnicalDepthChangeVolumeBonus < 0 ||
		a.Scoring.TechnicalDepthCriticalityBonus < 0 || a.Scoring.TechnicalDepthMax <= 0 {
		problems = append(problems, "scoring policy technical depth * values must be positive, and *_BONUS values must be non-negative")
	}
	if a.Scoring.TechnicalDepthChangedFilesMin <= 0 || a.Scoring.TechnicalDepthChangeVolumeMin <= 0 || a.Scoring.TechnicalDepthCriticalityCap <= 0 {
		problems = append(problems, "scoring policy technical depth * min/cap values must be positive")
	}
	if a.Scoring.TechnicalDepthMax < a.Scoring.TechnicalDepthBase {
		problems = append(problems, "scoring policy technical depth max must be >= scoring policy technical depth base")
	}
	if a.Scoring.BadgeMultiRepoRepositoryMin <= 0 || a.Scoring.BadgeSecurityXPMin <= 0 || a.Scoring.BadgeTestingXPMin <= 0 ||
		a.Scoring.BadgeConsistencyWeeksMin <= 0 || a.Scoring.BadgeEvidencePRLimit <= 0 {
		problems = append(problems, "scoring policy badge * threshold values must be positive")
	}
	if a.Scoring.DiminishingSimilarCap < 0 || a.Scoring.DiminishingCategoryCap < 0 || a.Scoring.DiminishingRepositoryThreshold < 0 {
		problems = append(problems, "scoring policy diminishing * cap/threshold values must be non-negative")
	}
	if a.Scoring.DiminishingSimilarStep < 0 || a.Scoring.DiminishingCategoryStep < 0 || a.Scoring.DiminishingRepositoryPenalty < 0 {
		problems = append(problems, "scoring policy diminishing * step/penalty values must be non-negative")
	}
	if a.Scoring.DiminishingModifierMin <= 0 || a.Scoring.DiminishingModifierMin > 1 {
		problems = append(problems, "scoring policy diminishing modifier min must be in (0, 1]")
	}
	if a.Scoring.SpamDocsSmallChangeSizeLimit <= 0 || a.Scoring.SpamTinyChangedFilesLimit <= 0 || a.Scoring.SpamTinyChangeSizeLimit <= 0 {
		problems = append(problems, "scoring policy spam * limit values must be positive")
	}
	if a.Scoring.SpamDocsSmallChangePenalty < 0 || a.Scoring.SpamTinyChangePenalty < 0 || a.Scoring.SpamDocsOnlyPenalty < 0 {
		problems = append(problems, "scoring policy spam * penalty values must be non-negative")
	}
	if a.Scoring.SpamPenaltyMax < 0 || a.Scoring.SpamPenaltyMax > 1 {
		problems = append(problems, "scoring policy spam penalty max must be between 0 and 1")
	}
	if a.Scoring.SpamMultiplierFloor <= 0 || a.Scoring.SpamMultiplierFloor > 1 {
		problems = append(problems, "scoring policy spam multiplier floor must be in (0, 1]")
	}
	if a.Scoring.SuspiciousPenaltyThreshold < 0 || a.Scoring.SuspiciousPenaltyThreshold > 1 {
		problems = append(problems, "scoring policy suspicious penalty threshold must be between 0 and 1")
	}
	if a.Scoring.LevelContributorMinXP <= 0 || a.Scoring.LevelBuilderMinXP <= 0 || a.Scoring.LevelSpecialistMinXP <= 0 ||
		a.Scoring.LevelMaintainerMinXP <= 0 || a.Scoring.LevelArchitectMinXP <= 0 {
		problems = append(problems, "scoring policy level * min xp values must be positive")
	}
	if !(a.Scoring.LevelContributorMinXP < a.Scoring.LevelBuilderMinXP &&
		a.Scoring.LevelBuilderMinXP < a.Scoring.LevelSpecialistMinXP &&
		a.Scoring.LevelSpecialistMinXP < a.Scoring.LevelMaintainerMinXP &&
		a.Scoring.LevelMaintainerMinXP < a.Scoring.LevelArchitectMinXP) {
		problems = append(problems, "scoring policy level * min xp values must be strictly increasing")
	}
	if a.Scheduler.WorkerConcurrency <= 0 {
		problems = append(problems, "JOB_WORKER_CONCURRENCY must be positive")
	}
	if a.Scheduler.LeaseTTL <= 0 {
		problems = append(problems, "JOB_LEASE_TTL must be positive")
	}
	if a.Scheduler.PollInterval <= 0 {
		problems = append(problems, "JOB_POLL_INTERVAL must be positive")
	}
	if strings.TrimSpace(a.Scheduler.DeadLetterQueue) == "" {
		problems = append(problems, "JOB_DEAD_LETTER_QUEUE is required")
	}
	if a.Scheduler.PerUserRateWindow <= 0 {
		problems = append(problems, "JOB_PER_USER_RATE_WINDOW must be positive")
	}
	if a.Scheduler.PerUserRateMax <= 0 {
		problems = append(problems, "JOB_PER_USER_RATE_MAX must be positive")
	}
	if a.Scheduler.PerInstallationRateWindow <= 0 {
		problems = append(problems, "JOB_PER_INSTALLATION_RATE_WINDOW must be positive")
	}
	if a.Scheduler.PerInstallationRateMax <= 0 {
		problems = append(problems, "JOB_PER_INSTALLATION_RATE_MAX must be positive")
	}

	if len(problems) == 0 {
		return nil
	}

	return errors.New(strings.Join(problems, "; "))
}

func (a App) ValidateOAuth() error {
	var missing []string

	if a.GitHubUserClientID() == "" {
		missing = append(missing, "GITHUB_APP_CLIENT_ID or GITHUB_CLIENT_ID")
	}
	if a.GitHubUserClientSecret() == "" {
		missing = append(missing, "GITHUB_APP_CLIENT_SECRET or GITHUB_CLIENT_SECRET")
	}
	if a.GitHub.OAuthRedirectURL == "" {
		missing = append(missing, "GITHUB_OAUTH_REDIRECT_URL")
	}

	if len(missing) == 0 {
		return nil
	}

	return fmt.Errorf("missing OAuth config: %s", strings.Join(missing, ", "))
}

func (a App) ValidateGitHubApp() error {
	missing := a.gitHubAppSyncRuntimeMissing()
	if normalizeConfigValue(a.GitHub.WebhookSecret) == "" {
		missing = append(missing, "GITHUB_WEBHOOK_SECRET")
	}

	if len(missing) == 0 {
		return nil
	}

	return fmt.Errorf("missing GitHub App config: %s", strings.Join(missing, ", "))
}

func (a App) ValidateGitHubAppSyncRuntime() error {
	missing := a.gitHubAppSyncRuntimeMissing()
	if len(missing) == 0 {
		return nil
	}
	return fmt.Errorf("missing GitHub App sync config: %s", strings.Join(missing, ", "))
}

func (a App) gitHubAppSyncRuntimeMissing() []string {
	var missing []string
	if a.GitHubAppJWTIssuer() == "" {
		missing = append(missing, "GITHUB_APP_ID or GITHUB_APP_CLIENT_ID")
	}
	if normalizeConfigValue(a.GitHub.AppClientID) == "" {
		missing = append(missing, "GITHUB_APP_CLIENT_ID")
	}
	if normalizeConfigValue(a.GitHub.AppClientSecret) == "" {
		missing = append(missing, "GITHUB_APP_CLIENT_SECRET")
	}
	if normalizeConfigValue(a.GitHub.AppPrivateKeyPEM) == "" {
		missing = append(missing, "GITHUB_APP_PRIVATE_KEY_PEM_PATH")
	}
	return missing
}

func (a App) ValidateAuthService() error {
	var problems []string

	if strings.TrimSpace(a.Database.URL) == "" {
		problems = append(problems, "DATABASE_URL is required")
	}
	if strings.TrimSpace(a.Auth.SessionSecret) == "" {
		problems = append(problems, "GITRANK_SESSION_SECRET is required")
	}
	if strings.TrimSpace(a.Auth.SessionCookieName) == "" {
		problems = append(problems, "AUTH_SESSION_COOKIE_NAME is required")
	}
	if strings.TrimSpace(a.Auth.CSRFCookieName) == "" {
		problems = append(problems, "AUTH_CSRF_COOKIE_NAME is required")
	}
	switch a.Auth.SessionCookieSameSite {
	case "lax", "strict", "none":
	default:
		problems = append(problems, "AUTH_COOKIE_SAME_SITE must be lax, strict, or none")
	}
	if a.Auth.SessionCookieSameSite == "none" && !a.Auth.SessionCookieSecure {
		problems = append(problems, "AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE=none")
	}
	if a.Auth.SessionTTL <= 0 {
		problems = append(problems, "AUTH_SESSION_TTL must be positive")
	}
	if a.Auth.SessionIdleTTL <= 0 {
		problems = append(problems, "AUTH_SESSION_IDLE_TTL must be positive")
	}
	if a.Auth.SessionRotationInterval <= 0 {
		problems = append(problems, "AUTH_SESSION_ROTATION_INTERVAL must be positive")
	}
	if a.Auth.OAuthStateTTL <= 0 {
		problems = append(problems, "AUTH_OAUTH_STATE_TTL must be positive")
	}
	if a.Auth.RateLimitWindow <= 0 {
		problems = append(problems, "AUTH_RATE_LIMIT_WINDOW must be positive")
	}
	if a.Auth.RateLimitMaxAttempts <= 0 {
		problems = append(problems, "AUTH_RATE_LIMIT_MAX_ATTEMPTS must be positive")
	}
	if a.IsProduction() {
		if strings.TrimSpace(a.Database.URL) == defaultLocalDatabaseURL {
			problems = append(problems, "DATABASE_URL must be overridden in production")
		}
		if strings.TrimSpace(a.Auth.SessionSecret) == defaultDevSessionSecret {
			problems = append(problems, "GITRANK_SESSION_SECRET must be overridden in production")
		}
		if strings.TrimSpace(a.Auth.JWTSigningKey) == defaultDevJWTSigningKey {
			problems = append(problems, "GITRANK_JWT_SIGNING_KEY must be overridden in production")
		}
		if strings.TrimSpace(a.Auth.TokenEncryptionKey) == defaultDevTokenEncryptionKey {
			problems = append(problems, "GITHUB_TOKEN_ENCRYPTION_KEY must be overridden in production")
		}
		if strings.TrimSpace(a.GitHub.ClientID) == defaultDevGitHubClientID && normalizeConfigValue(a.GitHub.AppClientID) == "" {
			problems = append(problems, "GITHUB_CLIENT_ID must be overridden in production")
		}
		if strings.TrimSpace(a.GitHub.ClientSecret) == defaultDevGitHubClientSecret && normalizeConfigValue(a.GitHub.AppClientSecret) == "" {
			problems = append(problems, "GITHUB_CLIENT_SECRET must be overridden in production")
		}
		if strings.TrimSpace(a.GitHub.OAuthRedirectURL) == defaultLocalOAuthRedirectURL {
			problems = append(problems, "GITHUB_OAUTH_REDIRECT_URL must be overridden in production")
		}
	}
	if strings.TrimSpace(a.Auth.TokenEncryptionKey) == "" {
		problems = append(problems, "GITHUB_TOKEN_ENCRYPTION_KEY is required")
	} else if _, err := decodeBase64Key(a.Auth.TokenEncryptionKey); err != nil {
		problems = append(problems, "GITHUB_TOKEN_ENCRYPTION_KEY must be base64-encoded 32 bytes")
	}
	for _, key := range a.Auth.PreviousTokenEncryptionKeys {
		if _, err := decodeBase64Key(key); err != nil {
			problems = append(problems, "GITHUB_PREVIOUS_TOKEN_ENCRYPTION_KEYS entries must be base64-encoded 32-byte keys")
			break
		}
	}
	if err := a.ValidateOAuth(); err != nil {
		problems = append(problems, err.Error())
	}

	if len(problems) == 0 {
		return nil
	}
	return errors.New(strings.Join(problems, "; "))
}

func (a App) ValidateProfileService() error {
	var problems []string

	if strings.TrimSpace(a.Database.URL) == "" {
		problems = append(problems, "DATABASE_URL is required")
	}
	if strings.TrimSpace(a.Auth.SessionSecret) == "" {
		problems = append(problems, "GITRANK_SESSION_SECRET is required")
	}
	if strings.TrimSpace(a.Auth.SessionCookieName) == "" {
		problems = append(problems, "AUTH_SESSION_COOKIE_NAME is required")
	}
	if strings.TrimSpace(a.Auth.CSRFCookieName) == "" {
		problems = append(problems, "AUTH_CSRF_COOKIE_NAME is required")
	}
	if a.IsProduction() {
		if strings.TrimSpace(a.Auth.SessionSecret) == defaultDevSessionSecret {
			problems = append(problems, "GITRANK_SESSION_SECRET must be overridden in production")
		}
		if strings.TrimSpace(a.Database.URL) == defaultLocalDatabaseURL {
			problems = append(problems, "DATABASE_URL must be overridden in production")
		}
	}
	if a.Profile.PublicCacheTTL <= 0 || a.Profile.PrivateCacheTTL <= 0 {
		problems = append(problems, "PROFILE_PUBLIC_CACHE_TTL and PROFILE_PRIVATE_CACHE_TTL must be positive durations")
	}
	if a.Profile.SnapshotStaleTTL <= 0 {
		problems = append(problems, "PROFILE_SNAPSHOT_STALE_TTL must be a positive duration")
	}
	if a.Profile.RecentReportsDefaultLimit <= 0 || a.Profile.RecentReportsMaxLimit <= 0 {
		problems = append(problems, "PROFILE_RECENT_REPORTS_DEFAULT_LIMIT and PROFILE_RECENT_REPORTS_MAX_LIMIT must be positive")
	}
	if a.Profile.RecentReportsMaxLimit < a.Profile.RecentReportsDefaultLimit {
		problems = append(problems, "PROFILE_RECENT_REPORTS_MAX_LIMIT must be >= PROFILE_RECENT_REPORTS_DEFAULT_LIMIT")
	}
	if a.Profile.ReportBackfillDefaultLimit <= 0 || a.Profile.ReportBackfillMaxLimit <= 0 {
		problems = append(problems, "PROFILE_REPORT_BACKFILL_DEFAULT_LIMIT and PROFILE_REPORT_BACKFILL_MAX_LIMIT must be positive")
	}
	if a.Profile.ReportBackfillMaxLimit < a.Profile.ReportBackfillDefaultLimit {
		problems = append(problems, "PROFILE_REPORT_BACKFILL_MAX_LIMIT must be >= PROFILE_REPORT_BACKFILL_DEFAULT_LIMIT")
	}
	if a.Profile.AccountExportAuditLimit <= 0 {
		problems = append(problems, "PROFILE_ACCOUNT_EXPORT_AUDIT_LIMIT must be positive")
	}

	if len(problems) == 0 {
		return nil
	}
	return errors.New(strings.Join(problems, "; "))
}

func (a App) ValidateScoringService() error {
	if strings.TrimSpace(a.Database.URL) == "" {
		return errors.New("DATABASE_URL is required")
	}
	return nil
}

func (a App) ValidatePRAnalyzerService() error {
	if strings.TrimSpace(a.Database.URL) == "" {
		return errors.New("DATABASE_URL is required")
	}
	return nil
}

func (a App) GitHubUserClientID() string {
	if appClientID := normalizeConfigValue(a.GitHub.AppClientID); appClientID != "" {
		return appClientID
	}
	return normalizeConfigValue(a.GitHub.ClientID)
}

func (a App) GitHubAppJWTIssuer() string {
	if appID := normalizeConfigValue(a.GitHub.AppID); appID != "" && appID != "0" {
		return appID
	}
	if appClientID := normalizeConfigValue(a.GitHub.AppClientID); appClientID != "" {
		return appClientID
	}
	return ""
}

func (a App) GitHubUserClientSecret() string {
	if appClientSecret := normalizeConfigValue(a.GitHub.AppClientSecret); appClientSecret != "" {
		return appClientSecret
	}
	return normalizeConfigValue(a.GitHub.ClientSecret)
}

func (a App) GitHubInstallURL() string {
	if installURL := normalizeConfigValue(a.GitHub.AppInstallURL); installURL != "" {
		return installURL
	}
	appSlug := normalizeConfigValue(a.GitHub.AppSlug)
	if appSlug == "" {
		return ""
	}
	return fmt.Sprintf("https://github.com/apps/%s/installations/new", appSlug)
}

func (a App) GitHubUserClientMode() string {
	if normalizeConfigValue(a.GitHub.AppClientID) != "" {
		return "github_app"
	}
	return "oauth_app"
}

func (a App) SessionSecretRing() [][]byte {
	out := make([][]byte, 0, 1+len(a.Auth.PreviousSessionSecrets))
	if strings.TrimSpace(a.Auth.SessionSecret) != "" {
		out = append(out, []byte(strings.TrimSpace(a.Auth.SessionSecret)))
	}
	for _, secret := range a.Auth.PreviousSessionSecrets {
		secret = strings.TrimSpace(secret)
		if secret == "" {
			continue
		}
		out = append(out, []byte(secret))
	}
	return out
}

func (a App) TokenEncryptionKeyRing() ([][]byte, error) {
	primary, err := decodeBase64Key(a.Auth.TokenEncryptionKey)
	if err != nil {
		return nil, err
	}
	out := [][]byte{primary}
	for _, encoded := range a.Auth.PreviousTokenEncryptionKeys {
		key, err := decodeBase64Key(encoded)
		if err != nil {
			return nil, err
		}
		out = append(out, key)
	}
	return out, nil
}

func (a App) GitHubUserAuthorizeScopes() []string {
	if a.GitHubUserClientMode() == "github_app" {
		return nil
	}
	return slices.Clone(a.GitHub.OAuthScopes)
}

func (a App) ValidateAI() error {
	if a.AI.Provider == "" {
		return errors.New("AI provider is required")
	}
	if a.AI.APIKey == "" {
		if normalizeAIProvider(a.AI.Provider) == "openai" {
			return errors.New("OPENAI_API_KEY is required for AI integration")
		}
		return errors.New("GEMINI_API_KEY is required for AI integration")
	}
	if a.AI.Model == "" {
		if normalizeAIProvider(a.AI.Provider) == "openai" {
			return errors.New("OPENAI_MODEL is required for AI integration")
		}
		return errors.New("GEMINI_MODEL is required for AI integration")
	}
	return nil
}

func (a App) IsProduction() bool {
	return a.Env == Production
}

func normalizeConfigValue(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	lower := strings.ToLower(trimmed)
	if lower == "replace-me" || strings.HasPrefix(lower, "replace-with-") {
		return ""
	}
	return trimmed
}

func (s Scoring) RankTierForXP(totalXP int) string {
	bronze, silver, gold, platinum, diamond, silverMin, goldMin, platinumMin, diamondMin := s.normalizedRankTierPolicy()
	switch {
	case totalXP >= diamondMin:
		return diamond
	case totalXP >= platinumMin:
		return platinum
	case totalXP >= goldMin:
		return gold
	case totalXP >= silverMin:
		return silver
	default:
		return bronze
	}
}

func (s Scoring) OrderedRankTiers() []string {
	bronze, silver, gold, platinum, diamond, _, _, _, _ := s.normalizedRankTierPolicy()
	order := make([]string, 0, 5)
	appendUnique := func(value string) {
		for _, existing := range order {
			if existing == value {
				return
			}
		}
		order = append(order, value)
	}
	appendUnique(bronze)
	appendUnique(silver)
	appendUnique(gold)
	appendUnique(platinum)
	appendUnique(diamond)
	return order
}

func (s Scoring) normalizedRankTierPolicy() (bronze, silver, gold, platinum, diamond string, silverMin, goldMin, platinumMin, diamondMin int) {
	defaults := DefaultScoringPolicy()
	bronze = strings.TrimSpace(s.RankTierBronzeLabel)
	if bronze == "" {
		bronze = defaults.RankTierBronzeLabel
	}
	silver = strings.TrimSpace(s.RankTierSilverLabel)
	if silver == "" {
		silver = defaults.RankTierSilverLabel
	}
	gold = strings.TrimSpace(s.RankTierGoldLabel)
	if gold == "" {
		gold = defaults.RankTierGoldLabel
	}
	platinum = strings.TrimSpace(s.RankTierPlatinumLabel)
	if platinum == "" {
		platinum = defaults.RankTierPlatinumLabel
	}
	diamond = strings.TrimSpace(s.RankTierDiamondLabel)
	if diamond == "" {
		diamond = defaults.RankTierDiamondLabel
	}

	silverMin = s.RankTierSilverMinXP
	if silverMin <= 0 {
		silverMin = defaults.RankTierSilverMinXP
	}
	goldMin = s.RankTierGoldMinXP
	if goldMin <= silverMin {
		goldMin = maxInt(defaults.RankTierGoldMinXP, silverMin+1)
	}
	platinumMin = s.RankTierPlatinumMinXP
	if platinumMin <= goldMin {
		platinumMin = maxInt(defaults.RankTierPlatinumMinXP, goldMin+1)
	}
	diamondMin = s.RankTierDiamondMinXP
	if diamondMin <= platinumMin {
		diamondMin = maxInt(defaults.RankTierDiamondMinXP, platinumMin+1)
	}
	return bronze, silver, gold, platinum, diamond, silverMin, goldMin, platinumMin, diamondMin
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func decodeBase64Key(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, errors.New("key is required")
	}
	raw, err := base64.RawStdEncoding.DecodeString(value)
	if err != nil {
		raw, err = base64.StdEncoding.DecodeString(value)
		if err != nil {
			return nil, err
		}
	}
	if len(raw) != 32 {
		return nil, errors.New("decoded key must be 32 bytes")
	}
	return raw, nil
}

func defaultServiceAddr(addrEnvKey string) string {
	switch strings.TrimSpace(addrEnvKey) {
	case "API_GATEWAY_ADDR":
		return ":8080"
	case "AUTH_SERVICE_ADDR":
		return ":8081"
	case "GITHUB_INGESTOR_ADDR":
		return ":8082"
	case "PR_ANALYZER_ADDR":
		return ":8083"
	case "PROFILE_SERVICE_ADDR":
		return ":8084"
	case "SCORING_ENGINE_ADDR":
		return ":8085"
	case "SCHEDULER_WORKER_ADDR":
		return ":8086"
	default:
		return ":8080"
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return fallback
}

func normalizeAIProvider(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "", "openai":
		return "openai"
	case "gemini":
		return "gemini"
	default:
		return normalized
	}
}

func resolveAIProvider(rawProvider string, explicit bool) string {
	normalized := normalizeAIProvider(rawProvider)
	if explicit {
		return normalized
	}
	openAIKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	geminiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if openAIKey == "" && geminiKey != "" {
		return "gemini"
	}
	return "openai"
}

func defaultAIModel(provider string) string {
	switch normalizeAIProvider(provider) {
	case "gemini":
		return "gemini-2.5-flash"
	default:
		return "gpt-4o-mini"
	}
}

func defaultAIBaseURL(provider string) string {
	switch normalizeAIProvider(provider) {
	case "gemini":
		return "https://generativelanguage.googleapis.com/v1beta/openai"
	default:
		return "https://api.openai.com/v1"
	}
}

func resolveAIEnv(provider, suffix, fallback string, allowSecondary bool) string {
	if value := strings.TrimSpace(os.Getenv("AI_" + suffix)); value != "" {
		return value
	}

	primaryPrefix := "OPENAI"
	secondaryPrefix := "GEMINI"
	if normalizeAIProvider(provider) == "gemini" {
		primaryPrefix = "GEMINI"
		secondaryPrefix = "OPENAI"
	}

	if value := strings.TrimSpace(os.Getenv(primaryPrefix + "_" + suffix)); value != "" {
		return value
	}
	if allowSecondary {
		if value := strings.TrimSpace(os.Getenv(secondaryPrefix + "_" + suffix)); value != "" {
			return value
		}
	}
	return fallback
}

func lookupTrimmedEnv(key string) (string, bool) {
	value, ok := os.LookupEnv(key)
	if !ok {
		return "", false
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return "", false
	}
	return value, true
}

func getBool(key string, fallback bool) bool {
	value := strings.ToLower(getEnv(key, ""))
	switch value {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	case "":
		return fallback
	default:
		return fallback
	}
}

func getInt(key string, fallback int) int {
	value := getEnv(key, "")
	if value == "" {
		return fallback
	}

	var parsed int
	_, err := fmt.Sscanf(value, "%d", &parsed)
	if err != nil {
		return fallback
	}
	return parsed
}

func getFloat(key string, fallback float64) float64 {
	value := getEnv(key, "")
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func getDuration(key string, fallback time.Duration) time.Duration {
	value := getEnv(key, "")
	if value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getCSV(key string) []string {
	return getCSVWithDefault(key, nil)
}

func getCSVWithDefault(key string, fallback []string) []string {
	value := getEnv(key, "")
	if value == "" {
		return slices.Clone(fallback)
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		out = append(out, part)
	}
	if len(out) == 0 {
		return slices.Clone(fallback)
	}
	return out
}

func validateURL(raw string) error {
	raw = strings.TrimSpace(raw)
	parsed, err := url.Parse(raw)
	if err != nil {
		return err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return fmt.Errorf("must include scheme and host")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("must use http or https")
	}
	if parsed.User != nil {
		return fmt.Errorf("must not include userinfo")
	}
	if parsed.RawQuery != "" {
		return fmt.Errorf("must not include a query string")
	}
	if parsed.Fragment != "" {
		return fmt.Errorf("must not include a fragment")
	}
	return nil
}
