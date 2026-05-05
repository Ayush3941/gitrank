package app

import (
	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func Manifest(cfg config.App, version string) contracts.ServiceManifest {
	return contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "GitHub App, user-token, and session lifecycle service.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/metrics", Summary: "Prometheus-style service metrics", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route manifest", Status: "implemented"},
			{Method: "GET", Path: "/oauth/github/install", Summary: "Redirect to GitHub App installation flow", Status: "implemented"},
			{Method: "GET", Path: "/oauth/github/start", Summary: "Start GitHub sign-in flow with CSRF-safe OAuth state", Status: "implemented"},
			{Method: "GET", Path: "/oauth/github/callback", Summary: "Complete GitHub sign-in or account-link flow", Status: "implemented"},
			{Method: "POST", Path: "/v1/account/link/start", Summary: "Begin authenticated GitHub account link or reauthorization flow", Status: "implemented"},
			{Method: "POST", Path: "/v1/account/unlink", Summary: "Unlink the active GitHub account and revoke local auth state", Status: "implemented"},
			{Method: "POST", Path: "/v1/account/delete", Summary: "Delete the active account and remove user-owned auth state", Status: "implemented"},
			{Method: "GET", Path: "/v1/session/me", Summary: "Authenticated session inspection", Status: "implemented"},
			{Method: "POST", Path: "/v1/session/refresh", Summary: "Rotate the current session and extend its lifetime", Status: "implemented"},
			{Method: "POST", Path: "/v1/session/logout", Summary: "Invalidate the current session", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "GitHub App install", Kind: "external_http", BaseURL: cfg.GitHubInstallURL(), Purpose: "App installation and repository grant flow", Auth: "browser_redirect", Critical: true, Status: "configured"},
			{Name: "GitHub OAuth authorize", Kind: "external_http", BaseURL: cfg.GitHub.AuthorizeURL, Purpose: "User authorization redirect", Auth: "client_id", Critical: true, Status: "configured"},
			{Name: "GitHub OAuth token", Kind: "external_http", BaseURL: cfg.GitHub.TokenURL, Purpose: "OAuth code exchange", Auth: "client_secret", Critical: true, Status: "configured"},
			{Name: "PostgreSQL", Kind: "database", BaseURL: cfg.Database.URL, Purpose: "Session, account, token, and audit persistence", Auth: "database_credentials", Critical: true, Status: "configured"},
		},
	}
}
