package githubapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"
)

func TestInstallationTokenBrokerCachesNormalizedRequests(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != http.MethodPost {
			t.Fatalf("method = %q, want POST", r.Method)
		}
		if r.URL.Path != "/app/installations/42/access_tokens" {
			t.Fatalf("path = %q, want %q", r.URL.Path, "/app/installations/42/access_tokens")
		}

		var request struct {
			RepositoryIDs []int64           `json:"repository_ids"`
			Permissions   map[string]string `json:"permissions"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if !reflect.DeepEqual(request.RepositoryIDs, []int64{9, 2}) {
			t.Fatalf("repository_ids = %v, want [9 2]", request.RepositoryIDs)
		}
		if !reflect.DeepEqual(request.Permissions, map[string]string{"contents": "read", "pull_requests": "write"}) {
			t.Fatalf("permissions = %v", request.Permissions)
		}

		_ = json.NewEncoder(w).Encode(InstallationAccessToken{
			Token:               fmt.Sprintf("token-%d", calls),
			ExpiresAt:           time.Now().UTC().Add(10 * time.Minute),
			Permissions:         request.Permissions,
			RepositorySelection: "selected",
		})
	}))
	defer server.Close()

	client, err := NewRESTClient(ClientConfig{
		BaseURL:          server.URL + "/",
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      StaticTokenSource("app-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	broker, err := NewInstallationTokenBroker(client, time.Minute)
	if err != nil {
		t.Fatalf("NewInstallationTokenBroker() error = %v", err)
	}

	first, err := broker.Token(context.Background(), InstallationTokenRequest{
		InstallationID: 42,
		RepositoryIDs:  []int64{9, 2},
		Permissions:    map[string]string{"pull_requests": "write", "contents": "read"},
	})
	if err != nil {
		t.Fatalf("Token(first) error = %v", err)
	}
	second, err := broker.Token(context.Background(), InstallationTokenRequest{
		InstallationID: 42,
		RepositoryIDs:  []int64{2, 9},
		Permissions:    map[string]string{"contents": "read", "pull_requests": "write"},
	})
	if err != nil {
		t.Fatalf("Token(second) error = %v", err)
	}

	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
	if first.Token != "token-1" || second.Token != "token-1" {
		t.Fatalf("tokens = %q, %q, want cached token-1", first.Token, second.Token)
	}
	if first.InstallationID != 42 || second.InstallationID != 42 {
		t.Fatalf("installation ids = %d, %d, want 42", first.InstallationID, second.InstallationID)
	}
}

func TestInstallationTokenBrokerRefreshesExpiringToken(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		_ = json.NewEncoder(w).Encode(InstallationAccessToken{
			Token:     fmt.Sprintf("token-%d", calls),
			ExpiresAt: time.Now().UTC().Add(10 * time.Minute),
		})
	}))
	defer server.Close()

	client, err := NewRESTClient(ClientConfig{
		BaseURL:          server.URL + "/",
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      StaticTokenSource("app-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	broker, err := NewInstallationTokenBroker(client, time.Minute)
	if err != nil {
		t.Fatalf("NewInstallationTokenBroker() error = %v", err)
	}
	req := InstallationTokenRequest{InstallationID: 7}
	key := installationTokenCacheKey(req)
	broker.cache[key] = InstallationAccessToken{
		Token:     "stale-token",
		ExpiresAt: time.Now().UTC().Add(30 * time.Second),
	}

	token, err := broker.Token(context.Background(), req)
	if err != nil {
		t.Fatalf("Token() error = %v", err)
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1 refresh request", calls)
	}
	if token.Token != "token-1" {
		t.Fatalf("token = %q, want refreshed token-1", token.Token)
	}
}
