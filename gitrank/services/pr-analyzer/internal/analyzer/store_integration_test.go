package analyzer

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestStoreSavePullRequestAnalysisUpsertsLatestArtifact(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_ANALYZER_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_ANALYZER_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	const repository = "octo/analyzer-store"
	if _, err := pool.Exec(ctx, `DELETE FROM repositories WHERE full_name = $1`, repository); err != nil {
		t.Fatalf("cleanup repository: %v", err)
	}

	var repositoryID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO repositories (
			github_repository_id,
			owner_login,
			name,
			full_name,
			primary_language,
			default_branch
		) VALUES (9911001, 'octo', 'analyzer-store', $1, 'Go', 'main')
		RETURNING id::text
	`, repository).Scan(&repositoryID); err != nil {
		t.Fatalf("insert repository: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO pull_requests (
			github_pull_request_id,
			repository_id,
			number,
			title,
			state,
			merged,
			created_at_source,
			updated_at_source,
			changed_files,
			additions,
			deletions,
			commits
		) VALUES (9912001, $1::uuid, 17, 'Add analyzer persistence', 'closed', true, $2, $2, 2, 40, 3, 2)
	`, repositoryID, time.Now().UTC().Add(-time.Hour)); err != nil {
		t.Fatalf("insert pull request: %v", err)
	}

	req := contracts.PullRequestAnalysisRequest{
		Repository: contracts.RepositoryContext{FullName: repository, PrimaryLanguage: "Go"},
		PullRequest: contracts.PullRequestContext{
			Number:       17,
			Title:        "Add analyzer persistence",
			State:        "closed",
			Merged:       true,
			Additions:    40,
			Deletions:    3,
			ChangedFiles: 2,
			Commits:      2,
			Files: []contracts.ChangedFile{
				{Path: "services/pr-analyzer/internal/analyzer/store.go", Additions: 35, Deletions: 2, Status: "modified"},
			},
		},
	}

	service := New()
	response, err := service.Analyze(req)
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}

	store := NewStore(pool)
	first, err := store.SavePullRequestAnalysis(ctx, req, response, time.Now().UTC())
	if err != nil {
		t.Fatalf("SavePullRequestAnalysis(first) error = %v", err)
	}
	response.Summary = "Updated deterministic summary."
	second, err := store.SavePullRequestAnalysis(ctx, req, response, time.Now().UTC().Add(time.Minute))
	if err != nil {
		t.Fatalf("SavePullRequestAnalysis(second) error = %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("second analysis id = %q, want first id %q", second.ID, first.ID)
	}

	var count int
	var summary string
	if err := pool.QueryRow(ctx, `
		SELECT count(*), max(summary)
		FROM contribution_analyses
		WHERE pull_request_id = $1::uuid
	`, first.PullRequestID).Scan(&count, &summary); err != nil {
		t.Fatalf("query contribution_analyses: %v", err)
	}
	if count != 1 {
		t.Fatalf("analysis row count = %d, want 1", count)
	}
	if summary != "Updated deterministic summary." {
		t.Fatalf("summary = %q, want updated summary", summary)
	}
}
