package app

import (
	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func Manifest(cfg config.App, version string) contracts.ServiceManifest {
	return contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "Profile read-model and schema service.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/metrics", Summary: "Prometheus-style service metrics", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route manifest", Status: "implemented"},
			{Method: "GET", Path: "/v1/profile/schema", Summary: "Public profile section schema", Status: "implemented"},
			{Method: "GET", Path: "/v1/leaderboard", Summary: "Public leaderboard from profile snapshots", Status: "implemented"},
			{Method: "GET", Path: "/v1/users/{handle}", Summary: "Public profile read model", Status: "implemented"},
			{Method: "GET", Path: "/v1/users/{handle}/card", Summary: "Shareable public profile card data", Status: "implemented"},
			{Method: "GET", Path: "/v1/me/profile", Summary: "Authenticated profile read model", Status: "implemented"},
			{Method: "PATCH", Path: "/v1/me/profile", Summary: "Update profile privacy controls", Status: "implemented"},
			{Method: "PATCH", Path: "/v1/me/profile/repositories/{owner}/{repo}", Summary: "Update per-repository visibility", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "PostgreSQL", Kind: "database", Purpose: "Profile snapshots and aggregates", Critical: true, Status: "configured"},
			{Name: "Redis", Kind: "cache", Purpose: "Cached profile summaries", Critical: false, Status: "configured"},
		},
	}
}
