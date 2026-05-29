package app

import (
	"testing"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
)

func TestManifestGitHubRESTDependencyStatusConfiguredWhenGitHubAppConfigValid(t *testing.T) {
	cfg := manifestTestConfig()

	manifest := Manifest(cfg, "test")
	dependency, found := dependencyByName(manifest.Dependencies, "GitHub REST API")
	if !found {
		t.Fatal("GitHub REST API dependency missing from manifest")
	}
	if dependency.Status != "configured" {
		t.Fatalf("dependency status = %q, want %q", dependency.Status, "configured")
	}
}

func TestManifestGitHubRESTDependencyStatusMisconfiguredWhenGitHubAppConfigMissing(t *testing.T) {
	cfg := manifestTestConfig()
	cfg.GitHub.AppPrivateKeyPEM = ""

	manifest := Manifest(cfg, "test")
	dependency, found := dependencyByName(manifest.Dependencies, "GitHub REST API")
	if !found {
		t.Fatal("GitHub REST API dependency missing from manifest")
	}
	if dependency.Status != "misconfigured" {
		t.Fatalf("dependency status = %q, want %q", dependency.Status, "misconfigured")
	}
}

func manifestTestConfig() config.App {
	return config.App{
		ServiceName: "api-gateway",
		GitHub: config.GitHub{
			AppID:            "12345",
			AppClientID:      "Iv1.test-client-id",
			AppClientSecret:  "test-client-secret",
			AppPrivateKeyPEM: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
			WebhookSecret:    "test-webhook-secret",
			APIBaseURL:       "https://api.github.com",
		},
	}
}

func dependencyByName(
	dependencies []contracts.DependencySpec,
	name string,
) (contracts.DependencySpec, bool) {
	for _, dependency := range dependencies {
		if dependency.Name == name {
			return dependency, true
		}
	}
	return contracts.DependencySpec{}, false
}
