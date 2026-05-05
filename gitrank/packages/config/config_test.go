package config

import (
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
	if cfg.Scheduler.WorkerConcurrency != 4 {
		t.Fatalf("Scheduler.WorkerConcurrency = %d, want 4", cfg.Scheduler.WorkerConcurrency)
	}
	if cfg.Scheduler.DeadLetterQueue != "github-sync-dead-letter" {
		t.Fatalf("Scheduler.DeadLetterQueue = %q, want github-sync-dead-letter", cfg.Scheduler.DeadLetterQueue)
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
	t.Setenv("AUTH_ADMIN_GITHUB_LOGINS", "Ayush3941,octocat")
	t.Setenv("GITHUB_API_VERSION", "2022-11-28")
	t.Setenv("GITHUB_USER_AGENT", "GitRank/test")
	t.Setenv("GITHUB_OAUTH_SCOPES", "read:user,user:email")
	t.Setenv("JOB_WORKER_CONCURRENCY", "9")
	t.Setenv("JOB_DEAD_LETTER_QUEUE", "custom-dead-letter")

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
	if len(cfg.Auth.AdminGitHubLogins) != 2 || cfg.Auth.AdminGitHubLogins[0] != "Ayush3941" {
		t.Fatalf("Auth.AdminGitHubLogins = %v, want [Ayush3941 octocat]", cfg.Auth.AdminGitHubLogins)
	}
	if cfg.GitHub.APIVersion != "2022-11-28" {
		t.Fatalf("GitHub.APIVersion = %q, want 2022-11-28", cfg.GitHub.APIVersion)
	}
	if cfg.GitHub.UserAgent != "GitRank/test" {
		t.Fatalf("GitHub.UserAgent = %q, want GitRank/test", cfg.GitHub.UserAgent)
	}
	if len(cfg.GitHub.OAuthScopes) != 2 || cfg.GitHub.OAuthScopes[0] != "read:user" {
		t.Fatalf("GitHub.OAuthScopes = %v, want read:user,user:email", cfg.GitHub.OAuthScopes)
	}
	if cfg.Scheduler.WorkerConcurrency != 9 {
		t.Fatalf("Scheduler.WorkerConcurrency = %d, want 9", cfg.Scheduler.WorkerConcurrency)
	}
	if cfg.Scheduler.DeadLetterQueue != "custom-dead-letter" {
		t.Fatalf("Scheduler.DeadLetterQueue = %q, want custom-dead-letter", cfg.Scheduler.DeadLetterQueue)
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
	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/gitrank?sslmode=disable")
	t.Setenv("GITRANK_SESSION_SECRET", "super-secret")
	t.Setenv("GITHUB_TOKEN_ENCRYPTION_KEY", "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
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
}
