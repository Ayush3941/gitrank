package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/authkit"
	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	cfg             config.App
	log             *slog.Logger
	store           *Store
	cache           *Cache
	sessionSecrets  [][]byte
	publicCacheTTL  time.Duration
	privateCacheTTL time.Duration
}

func New(cfg config.App, pool *pgxpool.Pool, cache *Cache, log *slog.Logger) (*Service, error) {
	if err := cfg.ValidateProfileService(); err != nil {
		return nil, err
	}
	setRankTierPolicy(cfg.Scoring)
	if cache == nil {
		cache = &Cache{}
	}

	return &Service{
		cfg:             cfg,
		log:             log,
		store:           NewStore(pool),
		cache:           cache,
		sessionSecrets:  cfg.SessionSecretRing(),
		publicCacheTTL:  5 * time.Minute,
		privateCacheTTL: 2 * time.Minute,
	}, nil
}

func (s *Service) Ready(ctx context.Context) error {
	if err := s.store.Ping(ctx); err != nil {
		return err
	}
	if s.cache != nil {
		if err := s.cache.Ping(ctx); err != nil {
			s.log.Warn("profile cache unavailable", "error", err)
		}
	}
	return nil
}

func (s *Service) MetricsSource() httpkit.PrometheusSource {
	if s == nil || s.cache == nil {
		return nil
	}
	return s.cache.MetricsSource()
}

func (s *Service) PublicProfile(ctx context.Context, handle string, now time.Time) (contracts.PublicProfileResponse, error) {
	user, err := s.store.LoadUserByHandle(ctx, handle)
	if err != nil {
		return contracts.PublicProfileResponse{}, err
	}

	settings, err := s.store.LoadProfileSettings(ctx, user.ID)
	if err != nil {
		return contracts.PublicProfileResponse{}, err
	}
	if !settings.Settings.PublicProfileEnabled || !strings.EqualFold(user.ProfileVisibility, "public") {
		return contracts.PublicProfileResponse{}, ErrProfileHidden
	}

	visibility, visUpdatedAt, err := s.store.LoadRepositoryVisibility(ctx, user.ID)
	if err != nil {
		return contracts.PublicProfileResponse{}, err
	}

	snapshot, err := s.ensureSnapshot(ctx, user, now.UTC())
	if err != nil {
		return contracts.PublicProfileResponse{}, err
	}

	cacheKey := fmt.Sprintf(
		"profile:public:%s:%s:%d:%d",
		strings.ToLower(strings.TrimSpace(handle)),
		snapshot.ID,
		settings.UpdatedAt.Unix(),
		visUpdatedAt.Unix(),
	)

	var cached contracts.PublicProfileResponse
	if hit, err := s.cache.GetJSON(ctx, cacheKey, &cached); err == nil && hit {
		return cached, nil
	} else if err != nil {
		s.log.Warn("profile cache read failed", "error", err, "cache_key", cacheKey)
	}

	response := publicResponseFromSnapshot(snapshot, settings.Settings, visibility, now.UTC())
	if err := s.cache.SetJSON(ctx, cacheKey, response, s.publicCacheTTL); err != nil {
		s.log.Warn("profile cache write failed", "error", err, "cache_key", cacheKey)
	}
	return response, nil
}

func (s *Service) PublicProfileCard(ctx context.Context, handle string, now time.Time) (contracts.ShareableProfileCard, error) {
	profile, err := s.PublicProfile(ctx, handle, now)
	if err != nil {
		return contracts.ShareableProfileCard{}, err
	}
	return profile.ShareCard, nil
}

func (s *Service) Leaderboard(ctx context.Context, limit int, now time.Time) (contracts.LeaderboardResponse, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	season, entries, ok, err := s.store.LoadFreshLeaderboardSeason(ctx, now.UTC(), limit)
	if err != nil {
		return contracts.LeaderboardResponse{}, err
	}
	if !ok {
		materializeLimit := limit
		if materializeLimit < leaderboardMaxMaterializedRows {
			materializeLimit = leaderboardMaxMaterializedRows
		}
		season, entries, err = s.store.MaterializeLeaderboardSeason(ctx, now.UTC(), materializeLimit)
		if err != nil {
			return contracts.LeaderboardResponse{}, err
		}
		if len(entries) > limit {
			entries = entries[:limit]
		}
	}

	views := make([]contracts.LeaderboardEntryView, 0, len(entries))
	for _, entry := range entries {
		views = append(views, leaderboardEntryFromSeasonSnapshot(entry, now.UTC()))
	}

	return contracts.LeaderboardResponse{
		Entries: views,
		Window: contracts.ProfileTimeWindow{
			Label:   season.SeasonKey,
			Bucket:  "week",
			StartAt: season.WindowStart.UTC(),
			EndAt:   season.WindowEnd.UTC(),
		},
		GeneratedAt:           season.GeneratedAt.UTC(),
		SeasonKey:             season.SeasonKey,
		SeasonSnapshotVersion: season.SnapshotVersion,
		ScoringVersion:        season.ScoreVersion,
	}, nil
}

func (s *Service) MaterializeLeaderboard(ctx context.Context, limit int, now time.Time) (contracts.LeaderboardMaterializationResponse, error) {
	if limit <= 0 || limit > leaderboardMaxMaterializedRows {
		limit = leaderboardMaxMaterializedRows
	}
	season, entries, err := s.store.MaterializeLeaderboardSeason(ctx, now.UTC(), limit)
	if err != nil {
		return contracts.LeaderboardMaterializationResponse{}, err
	}
	return contracts.LeaderboardMaterializationResponse{
		Status:                "materialized",
		SeasonKey:             season.SeasonKey,
		SeasonSnapshotVersion: season.SnapshotVersion,
		ScoringVersion:        season.ScoreVersion,
		EntryCount:            len(entries),
		Window: contracts.ProfileTimeWindow{
			Label:   season.SeasonKey,
			Bucket:  "week",
			StartAt: season.WindowStart.UTC(),
			EndAt:   season.WindowEnd.UTC(),
		},
		SourceWatermark: season.SourceWatermark.UTC(),
		GeneratedAt:     season.GeneratedAt.UTC(),
	}, nil
}

func (s *Service) BackfillLeaderboardHistory(ctx context.Context, weeks int, limit int, now time.Time) (contracts.LeaderboardHistoryBackfillResponse, error) {
	if weeks <= 0 {
		weeks = 26
	}
	if weeks > 156 {
		weeks = 156
	}
	if limit <= 0 || limit > leaderboardMaxMaterializedRows {
		limit = leaderboardMaxMaterializedRows
	}

	seasonKeys := make([]string, 0, weeks)
	seen := make(map[string]struct{}, weeks)
	totalEntries := 0
	var sourceWatermark time.Time

	for offset := 0; offset < weeks; offset++ {
		anchor := now.UTC().AddDate(0, 0, -7*offset)
		season, entries, err := s.store.MaterializeLeaderboardSeason(ctx, anchor, limit)
		if err != nil {
			return contracts.LeaderboardHistoryBackfillResponse{}, err
		}
		if _, ok := seen[season.SeasonKey]; ok {
			continue
		}
		seen[season.SeasonKey] = struct{}{}
		seasonKeys = append(seasonKeys, season.SeasonKey)
		totalEntries += len(entries)
		if sourceWatermark.IsZero() || season.SourceWatermark.After(sourceWatermark) {
			sourceWatermark = season.SourceWatermark.UTC()
		}
	}
	if sourceWatermark.IsZero() {
		sourceWatermark = now.UTC()
	}

	return contracts.LeaderboardHistoryBackfillResponse{
		Status:              "materialized",
		WeeksRequested:      weeks,
		SeasonsMaterialized: len(seasonKeys),
		EntryCountTotal:     totalEntries,
		SeasonKeys:          seasonKeys,
		SourceWatermark:     sourceWatermark,
		GeneratedAt:         now.UTC(),
	}, nil
}

func (s *Service) RefreshProfileByUserID(ctx context.Context, userID string, now time.Time) (contracts.ProfileRefreshResponse, error) {
	userID, err := contracts.NormalizeUUID(userID, "user_id")
	if err != nil {
		return contracts.ProfileRefreshResponse{}, ErrInvalidRequest
	}
	user, err := s.store.LoadUserByID(ctx, userID)
	if err != nil {
		return contracts.ProfileRefreshResponse{}, err
	}

	snapshot, err := s.rebuildSnapshot(ctx, user, now.UTC())
	if err != nil {
		return contracts.ProfileRefreshResponse{}, err
	}
	return contracts.ProfileRefreshResponse{
		Status:                 "completed",
		UserID:                 userID,
		ProfileSnapshotID:      snapshot.ID,
		ProfileSnapshotVersion: snapshot.SnapshotVersion,
		ScoreVersion:           scoreVersionFromSnapshot(snapshot),
		TotalXP:                snapshot.TotalXP,
		LevelLabel:             snapshot.LevelLabel,
		SourceWatermark:        snapshot.SourceWatermark.UTC(),
		RefreshedAt:            snapshot.RefreshedAt.UTC(),
		StaleAfter:             snapshot.StaleAfter.UTC(),
	}, nil
}

func (s *Service) PrivateProfile(ctx context.Context, sessionToken string, now time.Time) (contracts.PrivateProfileResponse, error) {
	principal, err := s.authenticate(ctx, sessionToken, now.UTC())
	if err != nil {
		return contracts.PrivateProfileResponse{}, err
	}

	user, err := s.store.LoadUserByID(ctx, principal.UserID)
	if err != nil {
		return contracts.PrivateProfileResponse{}, err
	}

	settings, err := s.store.LoadProfileSettings(ctx, user.ID)
	if err != nil {
		return contracts.PrivateProfileResponse{}, err
	}
	visibility, visUpdatedAt, err := s.store.LoadRepositoryVisibility(ctx, user.ID)
	if err != nil {
		return contracts.PrivateProfileResponse{}, err
	}

	snapshot, err := s.ensureSnapshot(ctx, user, now.UTC())
	if err != nil {
		return contracts.PrivateProfileResponse{}, err
	}

	cacheKey := fmt.Sprintf(
		"profile:private:%s:%s:%d:%d",
		user.ID,
		snapshot.ID,
		settings.UpdatedAt.Unix(),
		visUpdatedAt.Unix(),
	)

	var cached contracts.PrivateProfileResponse
	if hit, err := s.cache.GetJSON(ctx, cacheKey, &cached); err == nil && hit {
		return cached, nil
	} else if err != nil {
		s.log.Warn("profile cache read failed", "error", err, "cache_key", cacheKey)
	}

	recentReportRecords, err := s.store.LoadRecentPullRequestReportsForUser(ctx, user.ID, 4)
	if err != nil {
		return contracts.PrivateProfileResponse{}, err
	}

	response := privateResponseFromSnapshot(
		snapshot,
		settings.Settings,
		visibility,
		pullRequestReportsFromRecords(recentReportRecords, now.UTC()),
		now.UTC(),
	)
	if err := s.cache.SetJSON(ctx, cacheKey, response, s.privateCacheTTL); err != nil {
		s.log.Warn("profile cache write failed", "error", err, "cache_key", cacheKey)
	}
	return response, nil
}

func (s *Service) UpdatePrivacy(ctx context.Context, sessionToken, csrfToken string, req contracts.UpdateProfilePrivacyRequest, now time.Time) (contracts.PrivateProfileResponse, error) {
	principal, err := s.authenticate(ctx, sessionToken, now.UTC())
	if err != nil {
		return contracts.PrivateProfileResponse{}, err
	}
	if err := s.validateCSRF(sessionToken, csrfToken); err != nil {
		return contracts.PrivateProfileResponse{}, err
	}

	if _, err := s.store.UpdateProfileSettings(ctx, principal.UserID, req, now.UTC()); err != nil {
		return contracts.PrivateProfileResponse{}, err
	}
	return s.PrivateProfile(ctx, sessionToken, now.UTC())
}

func (s *Service) UpdateRepositoryVisibility(ctx context.Context, sessionToken, csrfToken, fullName string, req contracts.UpdateRepositoryVisibilityRequest, now time.Time) (contracts.PrivateProfileResponse, error) {
	principal, err := s.authenticate(ctx, sessionToken, now.UTC())
	if err != nil {
		return contracts.PrivateProfileResponse{}, err
	}
	if err := s.validateCSRF(sessionToken, csrfToken); err != nil {
		return contracts.PrivateProfileResponse{}, err
	}

	visibility := strings.ToLower(strings.TrimSpace(req.Visibility))
	switch visibility {
	case "public", "hidden":
	default:
		return contracts.PrivateProfileResponse{}, ErrInvalidRequest
	}

	if _, err := s.store.UpsertRepositoryVisibility(ctx, principal.UserID, fullName, visibility, strings.TrimSpace(req.Reason), now.UTC()); err != nil {
		return contracts.PrivateProfileResponse{}, err
	}
	return s.PrivateProfile(ctx, sessionToken, now.UTC())
}

func (s *Service) AccountDataExport(ctx context.Context, sessionToken string, now time.Time) (contracts.AccountDataExportResponse, error) {
	principal, err := s.authenticate(ctx, sessionToken, now.UTC())
	if err != nil {
		return contracts.AccountDataExportResponse{}, err
	}

	profile, err := s.PrivateProfile(ctx, sessionToken, now.UTC())
	if err != nil {
		return contracts.AccountDataExportResponse{}, err
	}

	exportRecord, err := s.store.LoadAccountExport(ctx, principal.UserID)
	if err != nil {
		return contracts.AccountDataExportResponse{}, err
	}

	redactions := []string{
		"session_token_hash, csrf_token_hash, encrypted GitHub access tokens, and encrypted refresh tokens are intentionally excluded",
	}
	for _, key := range exportRecord.RedactionNotes {
		redactions = append(redactions, "audit metadata key redacted: "+key)
	}

	return contracts.AccountDataExportResponse{
		ExportVersion:  "account-export/v1",
		GeneratedAt:    now.UTC(),
		User:           exportRecord.User,
		GitHubAccounts: exportRecord.GitHubAccounts,
		Profile:        profile,
		Sessions:       exportRecord.Sessions,
		AuditEvents:    exportRecord.AuditEvents,
		Redactions:     redactions,
	}, nil
}

func (s *Service) authenticate(ctx context.Context, sessionToken string, now time.Time) (sessionPrincipal, error) {
	if strings.TrimSpace(sessionToken) == "" {
		return sessionPrincipal{}, ErrUnauthorized
	}
	sessionHashes, err := authkit.HashOpaqueTokenCandidates(s.sessionSecrets, sessionToken)
	if err != nil {
		return sessionPrincipal{}, err
	}
	var lastErr error
	for _, sessionHash := range sessionHashes {
		principal, err := s.store.LoadSessionPrincipal(ctx, sessionHash, now.UTC())
		if err == nil {
			return principal, nil
		}
		lastErr = err
		if !errors.Is(err, ErrUnauthorized) {
			return sessionPrincipal{}, err
		}
	}
	if lastErr == nil {
		lastErr = ErrUnauthorized
	}
	return sessionPrincipal{}, lastErr
}

func (s *Service) validateCSRF(sessionToken, provided string) error {
	if err := authkit.ValidateDoubleSubmitCSRF(s.sessionSecrets, sessionToken, provided); err != nil {
		return ErrInvalidCSRF
	}
	return nil
}

func (s *Service) ensureSnapshot(ctx context.Context, user userRecord, now time.Time) (snapshotRecord, error) {
	existing, err := s.store.LoadLatestSnapshot(ctx, user.ID)
	if err == nil && now.UTC().Before(existing.StaleAfter) {
		return existing, nil
	}
	if err != nil && !errors.Is(err, ErrNotFound) {
		return snapshotRecord{}, err
	}

	snapshot, err := s.rebuildSnapshot(ctx, user, now.UTC())
	if err != nil {
		if existing.ID != "" {
			return existing, nil
		}
		return snapshotRecord{}, err
	}
	return snapshot, nil
}

func (s *Service) rebuildSnapshot(ctx context.Context, user userRecord, now time.Time) (snapshotRecord, error) {
	scoreSelection, err := s.store.LoadLatestScoreSelection(ctx, user.ID)
	if err != nil {
		return snapshotRecord{}, err
	}
	scoreRows, err := s.store.LoadScoreRows(ctx, user.ID, scoreSelection)
	if err != nil {
		return snapshotRecord{}, err
	}
	badges, err := s.store.LoadBadges(ctx, user.ID, badgeFallbackPRIDs(scoreRows, 5))
	if err != nil {
		return snapshotRecord{}, err
	}

	built := buildSnapshot(user, scoreRows, badges, now.UTC())
	snapshot, err := s.store.InsertSnapshot(ctx, user.ID, built)
	if err != nil {
		return snapshotRecord{}, err
	}
	if _, err := s.store.MaterializeQuestBoard(ctx, user.ID, snapshot, buildQuestsFromSnapshot(snapshot, now.UTC()), now.UTC()); err != nil {
		return snapshotRecord{}, err
	}
	return snapshot, nil
}

func publicResponseFromSnapshot(snapshot snapshotRecord, settings contracts.ProfilePrivacySettings, visibility []repositoryVisibilityRecord, now time.Time) contracts.PublicProfileResponse {
	repoMap := visibilityMap(visibility)
	publicRepos := make([]contracts.TopRepositoryView, 0, len(snapshot.Repositories))
	for _, repository := range snapshot.Repositories {
		if override, ok := repoMap[strings.ToLower(repository.FullName)]; ok {
			repository.Visibility = override.Visibility
		}
		if strings.EqualFold(repository.Visibility, "hidden") {
			continue
		}
		publicRepos = append(publicRepos, repository)
	}

	publicHistory := make([]contracts.ScoreHistoryEntry, 0, len(snapshot.ScoreHistory))
	if settings.ShowExactPRs {
		publicHistory = append(publicHistory, snapshot.ScoreHistory...)
		if !settings.ShowAISummaries {
			for i := range publicHistory {
				publicHistory[i].Explanation = nil
			}
		}
	}

	staleness := snapshotStaleness(snapshot, now.UTC())
	return contracts.PublicProfileResponse{
		Summary:         snapshot.Summary,
		TopSkillAreas:   skillAreasWithEvidenceState(snapshot.TopSkills, skillEvidenceStateFromStaleness(staleness)),
		TopRepositories: publicRepos,
		Level:           snapshot.ShareCard.Level,
		Badges:          snapshot.Badges,
		ScoreHistory:    publicHistory,
		Timeline:        snapshot.Timeline,
		ShareCard:       snapshot.ShareCard,
		Staleness:       staleness,
	}
}

func privateResponseFromSnapshot(snapshot snapshotRecord, settings contracts.ProfilePrivacySettings, visibility []repositoryVisibilityRecord, recentReports []contracts.PullRequestReportResponse, now time.Time) contracts.PrivateProfileResponse {
	repoMap := visibilityMap(visibility)
	privateRepos := make([]contracts.TopRepositoryView, 0, len(snapshot.Repositories))
	for _, repository := range snapshot.Repositories {
		if override, ok := repoMap[strings.ToLower(repository.FullName)]; ok {
			repository.Visibility = override.Visibility
		}
		privateRepos = append(privateRepos, repository)
	}

	visibilityViews := make([]contracts.RepositoryVisibilityView, 0, len(privateRepos))
	seen := make(map[string]struct{}, len(privateRepos))
	for _, repository := range privateRepos {
		view := contracts.RepositoryVisibilityView{
			FullName:   repository.FullName,
			Visibility: repository.Visibility,
		}
		if override, ok := repoMap[strings.ToLower(repository.FullName)]; ok {
			view.Reason = override.Reason
		}
		visibilityViews = append(visibilityViews, view)
		seen[strings.ToLower(repository.FullName)] = struct{}{}
	}
	for _, override := range visibility {
		key := strings.ToLower(override.FullName)
		if _, ok := seen[key]; ok {
			continue
		}
		visibilityViews = append(visibilityViews, contracts.RepositoryVisibilityView{
			FullName:   override.FullName,
			Visibility: override.Visibility,
			Reason:     override.Reason,
		})
	}

	sortRepositoryVisibility(visibilityViews)
	staleness := snapshotStaleness(snapshot, now.UTC())
	return contracts.PrivateProfileResponse{
		Summary:              snapshot.Summary,
		TopSkillAreas:        skillAreasWithEvidenceState(snapshot.TopSkills, skillEvidenceStateFromStaleness(staleness)),
		TopRepositories:      privateRepos,
		Level:                snapshot.ShareCard.Level,
		Badges:               snapshot.Badges,
		Timeline:             snapshot.Timeline,
		ScoreHistory:         snapshot.ScoreHistory,
		RecentPRReports:      recentReports,
		Privacy:              settings,
		RepositoryVisibility: visibilityViews,
		ShareCard:            snapshot.ShareCard,
		Staleness:            staleness,
	}
}

func visibilityMap(records []repositoryVisibilityRecord) map[string]repositoryVisibilityRecord {
	out := make(map[string]repositoryVisibilityRecord, len(records))
	for _, record := range records {
		out[strings.ToLower(record.FullName)] = record
	}
	return out
}

func snapshotStaleness(snapshot snapshotRecord, now time.Time) contracts.ProfileStaleness {
	return contracts.ProfileStaleness{
		RefreshedAt:             snapshot.RefreshedAt.UTC(),
		StaleAfter:              snapshot.StaleAfter.UTC(),
		SourceWatermark:         snapshot.SourceWatermark.UTC(),
		IsStale:                 now.UTC().After(snapshot.StaleAfter.UTC()),
		PartialProfileAvailable: snapshot.ID != "",
	}
}

func skillEvidenceStateFromStaleness(staleness contracts.ProfileStaleness) string {
	if staleness.IsStale {
		return "stale"
	}
	if staleness.PartialProfileAvailable && staleness.SourceWatermark.IsZero() {
		return "partial"
	}
	return "fresh"
}

func skillAreasWithEvidenceState(skills []contracts.SkillAreaView, state string) []contracts.SkillAreaView {
	if len(skills) == 0 {
		return nil
	}
	out := make([]contracts.SkillAreaView, len(skills))
	copy(out, skills)
	normalized := normalizeSkillEvidenceState(state)
	for i := range out {
		if strings.TrimSpace(out[i].EvidenceSource) == "" {
			out[i].EvidenceSource = "unknown"
		}
		out[i].EvidenceState = normalized
	}
	return out
}

func sortRepositoryVisibility(values []contracts.RepositoryVisibilityView) {
	for i := 0; i < len(values); i++ {
		for j := i + 1; j < len(values); j++ {
			if values[j].FullName < values[i].FullName {
				values[i], values[j] = values[j], values[i]
			}
		}
	}
}
