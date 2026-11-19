package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5"
)

type reportAccess struct {
	AuthorUserID    string
	Public          bool
	ShowAISummaries bool
}

// PullRequestReport permits the author to inspect their own unpublished report.
func (s *Service) PullRequestReport(ctx context.Context, sessionToken, owner, repo string, number int, now time.Time) (contracts.PullRequestReportResponse, error) {
	if strings.TrimSpace(owner) == "" || strings.TrimSpace(repo) == "" || number <= 0 {
		return contracts.PullRequestReportResponse{}, ErrInvalidRequest
	}
	access, err := s.store.loadReportAccess(ctx, owner, repo, number)
	if err != nil {
		return contracts.PullRequestReportResponse{}, err
	}
	if sessionToken != "" && access.AuthorUserID != "" {
		principal, err := s.authenticate(ctx, sessionToken, now.UTC())
		if err == nil && principal.UserID == access.AuthorUserID {
			return s.InternalPullRequestReport(ctx, owner, repo, number, now)
		}
		if err != nil && !errors.Is(err, ErrUnauthorized) {
			return contracts.PullRequestReportResponse{}, err
		}
	}
	if !access.Public {
		return contracts.PullRequestReportResponse{}, ErrNotFound
	}
	report, err := s.InternalPullRequestReport(ctx, owner, repo, number, now)
	if err == nil && !access.ShowAISummaries {
		visible := false
		report.AISummaryVisible = &visible
	}
	return report, err
}

func (s *Store) loadReportAccess(ctx context.Context, owner, repo string, number int) (reportAccess, error) {
	var access reportAccess
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(u.id::text, ''),
			LOWER(COALESCE(u.profile_visibility, 'public')) = 'public'
				AND COALESCE(settings.show_exact_prs, TRUE)
				AND COALESCE(visibility.visibility, 'public') <> 'hidden',
			COALESCE(settings.show_ai_summaries, TRUE)
		FROM repositories r
		JOIN pull_requests pr ON pr.repository_id = r.id
		LEFT JOIN github_accounts author ON author.id = pr.author_github_account_id
		LEFT JOIN LATERAL (
			SELECT user_id FROM github_accounts
			WHERE user_id IS NOT NULL
			  AND LOWER(login) = LOWER(pr.payload_jsonb #>> '{user,login}')
			ORDER BY linked_at DESC, id DESC LIMIT 1
		) login_author ON author.user_id IS NULL
		LEFT JOIN LATERAL (
			SELECT user_id FROM score_events
			WHERE pull_request_id = pr.id AND event_type = 'score.computed'
			ORDER BY created_at DESC, id DESC LIMIT 1
		) scored_author ON COALESCE(author.user_id, login_author.user_id) IS NULL
		LEFT JOIN users u ON u.id = COALESCE(author.user_id, login_author.user_id, scored_author.user_id)
		LEFT JOIN user_profile_settings settings ON settings.user_id = u.id
		LEFT JOIN user_repository_visibility visibility ON visibility.user_id = u.id AND visibility.repository_id = r.id
		WHERE LOWER(r.owner_login) = LOWER($1) AND LOWER(r.name) = LOWER($2)
		  AND pr.number = $3 AND r.is_private = FALSE
	`, owner, repo, number).Scan(&access.AuthorUserID, &access.Public, &access.ShowAISummaries)
	if errors.Is(err, pgx.ErrNoRows) {
		return reportAccess{}, ErrNotFound
	}
	return access, err
}
