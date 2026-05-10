package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"
)

type Environment string

const (
	Development Environment = "development"
	Staging     Environment = "staging"
	Production  Environment = "production"
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
	DeviceURL                      string
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
	MaxBodyBytes                   int
	DedupeTTL                      time.Duration
	FailedLookback                 time.Duration
	RefreshSkew                    time.Duration
	SecondaryBackoff               time.Duration
	RepositoryCacheTTL             time.Duration
	MaxConcurrency                 int
	CircuitBreakerFailureThreshold int
	CircuitBreakerOpenInterval     time.Duration
	CircuitBreakerHalfOpenMax      int
}

type AI struct {
	Provider        string
	APIKey          string
	Model           string
	BaseURL         string
	RequestTimeout  time.Duration
	ModerationModel string
	EmbeddingModel  string
}

type Observability struct {
	Enabled           bool
	OTLPEndpoint      string
	ServiceNamespace  string
	MetricsEnabled    bool
	DistributedTraces bool
}

type Scheduler struct {
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
	cfg := App{
		Env:             Environment(getEnv("GITRANK_ENV", string(Development))),
		ServiceName:     getEnv("GITRANK_SERVICE_NAME", serviceName),
		PublicBaseURL:   getEnv("GITRANK_PUBLIC_BASE_URL", "http://localhost:3000"),
		APIBaseURL:      getEnv("GITRANK_API_BASE_URL", "http://localhost:8080"),
		Addr:            getEnv(addrEnvKey, ":8080"),
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
			URL: getEnv("DATABASE_URL", ""),
		},
		Redis: Redis{
			URL: getEnv("REDIS_URL", ""),
		},
		Auth: Auth{
			SessionSecret:               getEnv("GITRANK_SESSION_SECRET", ""),
			PreviousSessionSecrets:      getCSV("GITRANK_PREVIOUS_SESSION_SECRETS"),
			JWTSigningKey:               getEnv("GITRANK_JWT_SIGNING_KEY", ""),
			SessionCookieName:           getEnv("AUTH_SESSION_COOKIE_NAME", "gitrank_session"),
			CSRFCookieName:              getEnv("AUTH_CSRF_COOKIE_NAME", "gitrank_csrf"),
			SessionCookieDomain:         getEnv("AUTH_COOKIE_DOMAIN", ""),
			SessionCookieSecure:         getBool("AUTH_COOKIE_SECURE", false),
			SessionCookieSameSite:       strings.ToLower(getEnv("AUTH_COOKIE_SAME_SITE", "lax")),
			SessionTTL:                  getDuration("AUTH_SESSION_TTL", 30*24*time.Hour),
			SessionIdleTTL:              getDuration("AUTH_SESSION_IDLE_TTL", 72*time.Hour),
			SessionRotationInterval:     getDuration("AUTH_SESSION_ROTATION_INTERVAL", 24*time.Hour),
			OAuthStateTTL:               getDuration("AUTH_OAUTH_STATE_TTL", 10*time.Minute),
			TokenEncryptionKey:          getEnv("GITHUB_TOKEN_ENCRYPTION_KEY", ""),
			PreviousTokenEncryptionKeys: getCSV("GITHUB_PREVIOUS_TOKEN_ENCRYPTION_KEYS"),
			AdminGitHubLogins:           getCSV("AUTH_ADMIN_GITHUB_LOGINS"),
			MaintainerGitHubLogins:      getCSV("AUTH_MAINTAINER_GITHUB_LOGINS"),
			RateLimitWindow:             getDuration("AUTH_RATE_LIMIT_WINDOW", time.Minute),
			RateLimitMaxAttempts:        getInt("AUTH_RATE_LIMIT_MAX_ATTEMPTS", 30),
		},
		GitHub: GitHub{
			ClientID:                       getEnv("GITHUB_CLIENT_ID", ""),
			ClientSecret:                   getEnv("GITHUB_CLIENT_SECRET", ""),
			AuthorizeURL:                   getEnv("GITHUB_OAUTH_AUTHORIZE_URL", "https://github.com/login/oauth/authorize"),
			TokenURL:                       getEnv("GITHUB_OAUTH_EXCHANGE_URL", getEnv("GITHUB_OAUTH_TOKEN_URL", "https://github.com/login/oauth/access_token")),
			DeviceURL:                      getEnv("GITHUB_OAUTH_DEVICE_URL", "https://github.com/login/device/code"),
			OAuthRedirectURL:               getEnv("GITHUB_OAUTH_REDIRECT_URL", ""),
			AppID:                          getEnv("GITHUB_APP_ID", ""),
			AppSlug:                        getEnv("GITHUB_APP_SLUG", ""),
			AppInstallURL:                  getEnv("GITHUB_APP_INSTALL_URL", ""),
			AppClientID:                    getEnv("GITHUB_APP_CLIENT_ID", ""),
			AppClientSecret:                getEnv("GITHUB_APP_CLIENT_SECRET", ""),
			AppPrivateKeyPEM:               getEnv("GITHUB_APP_PRIVATE_KEY_PEM_PATH", ""),
			WebhookSecret:                  getEnv("GITHUB_WEBHOOK_SECRET", ""),
			APIBaseURL:                     getEnv("GITHUB_API_BASE_URL", "https://api.github.com"),
			GraphQLURL:                     getEnv("GITHUB_GRAPHQL_URL", "https://api.github.com/graphql"),
			APIVersion:                     getEnv("GITHUB_API_VERSION", "2026-03-10"),
			UserAgent:                      getEnv("GITHUB_USER_AGENT", "GitRank/dev"),
			OAuthScopes:                    getCSVWithDefault("GITHUB_OAUTH_SCOPES", []string{"read:user", "user:email"}),
			RequestTimeout:                 getDuration("GITHUB_REQUEST_TIMEOUT", 10*time.Second),
			MaxPageSize:                    getInt("GITHUB_MAX_PAGE_SIZE", 100),
			GraphQLPageSize:                getInt("GITHUB_GRAPHQL_PAGE_SIZE", 100),
			MaxBodyBytes:                   getInt("GITHUB_WEBHOOK_MAX_BODY_BYTES", 1<<20),
			DedupeTTL:                      getDuration("GITHUB_WEBHOOK_DEDUPE_TTL", 7*24*time.Hour),
			FailedLookback:                 getDuration("GITHUB_FAILED_DELIVERY_LOOKBACK", 72*time.Hour),
			RefreshSkew:                    getDuration("GITHUB_INSTALLATION_REFRESH_SKEW", getDuration("GITHUB_INSTALLATION_TOKEN_REFRESH_SKEW", 5*time.Minute)),
			SecondaryBackoff:               getDuration("GITHUB_SECONDARY_RATE_LIMIT_BACKOFF", time.Minute),
			RepositoryCacheTTL:             getDuration("GITHUB_REPOSITORY_CACHE_TTL", 10*time.Minute),
			MaxConcurrency:                 getInt("GITHUB_MAX_CONCURRENT_REQUESTS", 8),
			CircuitBreakerFailureThreshold: getInt("GITHUB_CIRCUIT_BREAKER_FAILURE_THRESHOLD", 5),
			CircuitBreakerOpenInterval:     getDuration("GITHUB_CIRCUIT_BREAKER_OPEN_INTERVAL", 30*time.Second),
			CircuitBreakerHalfOpenMax:      getInt("GITHUB_CIRCUIT_BREAKER_HALF_OPEN_MAX_REQUESTS", 1),
		},
		AI: AI{
			Provider:        getEnv("AI_PROVIDER", "openai"),
			APIKey:          getEnv("OPENAI_API_KEY", ""),
			Model:           getEnv("OPENAI_MODEL", "gpt-5.5"),
			BaseURL:         getEnv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
			RequestTimeout:  getDuration("AI_REQUEST_TIMEOUT", 20*time.Second),
			ModerationModel: getEnv("OPENAI_MODERATION_MODEL", "omni-moderation-latest"),
			EmbeddingModel:  getEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
		},
		Observability: Observability{
			Enabled:           getBool("OTEL_ENABLED", false),
			OTLPEndpoint:      getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318"),
			ServiceNamespace:  getEnv("OTEL_SERVICE_NAMESPACE", "gitrank"),
			MetricsEnabled:    getBool("OTEL_METRICS_ENABLED", true),
			DistributedTraces: getBool("OTEL_TRACES_ENABLED", true),
		},
		Scheduler: Scheduler{
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
		"GITHUB_OAUTH_DEVICE_URL":    a.GitHub.DeviceURL,
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
	if a.GitHub.FailedLookback <= 0 {
		problems = append(problems, "GITHUB_FAILED_DELIVERY_LOOKBACK must be positive")
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
	var missing []string

	if a.GitHub.AppID == "" || a.GitHub.AppID == "0" {
		missing = append(missing, "GITHUB_APP_ID")
	}
	if a.GitHub.AppClientID == "" {
		missing = append(missing, "GITHUB_APP_CLIENT_ID")
	}
	if a.GitHub.AppClientSecret == "" {
		missing = append(missing, "GITHUB_APP_CLIENT_SECRET")
	}
	if a.GitHub.AppPrivateKeyPEM == "" {
		missing = append(missing, "GITHUB_APP_PRIVATE_KEY_PEM_PATH")
	}
	if a.GitHub.WebhookSecret == "" {
		missing = append(missing, "GITHUB_WEBHOOK_SECRET")
	}

	if len(missing) == 0 {
		return nil
	}

	return fmt.Errorf("missing GitHub App config: %s", strings.Join(missing, ", "))
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

func (a App) GitHubUserClientID() string {
	if a.GitHub.AppClientID != "" {
		return a.GitHub.AppClientID
	}
	return a.GitHub.ClientID
}

func (a App) GitHubUserClientSecret() string {
	if a.GitHub.AppClientSecret != "" {
		return a.GitHub.AppClientSecret
	}
	return a.GitHub.ClientSecret
}

func (a App) GitHubInstallURL() string {
	if strings.TrimSpace(a.GitHub.AppInstallURL) != "" {
		return strings.TrimSpace(a.GitHub.AppInstallURL)
	}
	if strings.TrimSpace(a.GitHub.AppSlug) == "" {
		return ""
	}
	return fmt.Sprintf("https://github.com/apps/%s/installations/new", strings.TrimSpace(a.GitHub.AppSlug))
}

func (a App) GitHubUserClientMode() string {
	if a.GitHub.AppClientID != "" {
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
		return errors.New("OPENAI_API_KEY is required for AI integration")
	}
	if a.AI.Model == "" {
		return errors.New("OPENAI_MODEL is required for AI integration")
	}
	return nil
}

func (a App) IsProduction() bool {
	return a.Env == Production
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

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return strings.TrimSpace(value)
	}
	return fallback
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
