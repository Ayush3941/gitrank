package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/githubapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

func BenchmarkPersistWebhookPullRequestThroughput(b *testing.B) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_INGESTOR_DATABASE_URL"))
	if databaseURL == "" {
		b.Skip("GITRANK_INGESTOR_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		b.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	svc := New(pool)
	now := time.Now().UTC()
	uniqueBase := now.UnixNano() % 1_000_000_000

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sequence := uniqueBase + int64(i)
		repositoryID := 9_000_000_000 + sequence
		pullRequestID := 8_000_000_000 + sequence
		authorID := 7_000_000_000 + sequence
		repositoryFullName := fmt.Sprintf("bench-owner-%d/repo-%d", uniqueBase, i)
		payload := []byte(fmt.Sprintf(`{
			"action":"closed",
			"number":%d,
			"installation":{"id":%d,"repository_selection":"selected","account":{"login":"bench-owner-%d","type":"Organization"}},
			"repository":{"id":%d,"name":"repo-%d","full_name":"%s","private":false,"fork":false,"language":"Go","default_branch":"main","stargazers_count":10,"forks_count":1,"open_issues_count":0,"archived":false,"disabled":false,"owner":{"login":"bench-owner-%d","type":"Organization"}},
			"pull_request":{
				"id":%d,
				"number":%d,
				"title":"Benchmark webhook persistence",
				"state":"closed",
				"draft":false,
				"merged":true,
				"merged_at":"2026-05-06T12:00:00Z",
				"created_at":"2026-05-06T11:00:00Z",
				"updated_at":"2026-05-06T12:00:00Z",
				"closed_at":"2026-05-06T12:00:00Z",
				"base":{"ref":"main"},
				"head":{"ref":"bench"},
				"changed_files":2,
				"additions":40,
				"deletions":5,
				"commits":1,
				"user":{"id":%d,"login":"bench-author-%d"},
				"labels":[{"id":%d,"name":"benchmark","color":"0366d6","default":false}]
			}
		}`, i+1, 6_000_000_000+sequence, uniqueBase, repositoryID, i, repositoryFullName, uniqueBase, pullRequestID, i+1, authorID, sequence, 5_000_000_000+sequence))

		_, err := svc.PersistWebhook(ctx, githubapi.WebhookEnvelope{
			DeliveryID:   fmt.Sprintf("bench-delivery-%d", sequence),
			EventType:    "pull_request",
			Repository:   repositoryFullName,
			RepositoryID: repositoryID,
			Installation: 6_000_000_000 + sequence,
			Number:       i + 1,
			Payload:      payload,
		}, fmt.Sprintf("bench-correlation-%d", sequence), now)
		if err != nil {
			b.Fatalf("PersistWebhook() error = %v", err)
		}
	}
}
