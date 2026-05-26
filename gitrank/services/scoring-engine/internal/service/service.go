package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/services/scoring-engine/internal/scoring"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrInvalidRequest = errors.New("invalid request")
	ErrUnavailable    = errors.New("scoring persistence unavailable")
)

type Service struct {
	cfg    config.App
	log    *slog.Logger
	engine scoring.Engine
	store  *Store
}

func New(cfg config.App, pool *pgxpool.Pool, log *slog.Logger) (*Service, error) {
	engine := scoring.NewWithPolicy(cfg.Scoring)
	return &Service{
		cfg:    cfg,
		log:    log,
		engine: engine,
		store:  NewStore(pool),
	}, nil
}

func (s *Service) Ready(ctx context.Context) error {
	if s == nil || s.store == nil || s.store.pool == nil {
		return nil
	}
	return s.store.Ping(ctx)
}

func (s *Service) Score(req contracts.ScoreContributionRequest) contracts.ScoreContributionResponse {
	return s.engine.Score(req)
}

func (s *Service) ReplayUser(ctx context.Context, userID string, req contracts.ReplayUserScoresRequest, now time.Time) (contracts.ReplayUserScoresResponse, error) {
	if s == nil || s.store == nil || s.store.pool == nil {
		return contracts.ReplayUserScoresResponse{}, ErrUnavailable
	}
	if strings.TrimSpace(userID) == "" {
		return contracts.ReplayUserScoresResponse{}, ErrInvalidRequest
	}
	if err := req.Validate(); err != nil {
		return contracts.ReplayUserScoresResponse{}, err
	}
	if err := s.store.EnsureUser(ctx, userID); err != nil {
		return contracts.ReplayUserScoresResponse{}, err
	}

	candidates, err := s.store.LoadReplayCandidates(ctx, userID)
	if err != nil {
		return contracts.ReplayUserScoresResponse{}, err
	}

	triggerType := normalizeTriggerType(req.TriggerType)
	events, snapshot, badges, aggregateSkills, sourceWatermark := s.buildReplay(userID, triggerType, candidates, now.UTC())
	run, savedSnapshot, err := s.store.SaveReplay(ctx, replayRunRecord{
		UserID:           userID,
		ScoreVersion:     s.scoreVersion(),
		TriggerType:      triggerType,
		Status:           "completed",
		SourceWatermark:  sourceWatermark,
		EventCount:       len(events),
		AggregateTotalXP: snapshot.TotalXP,
		AggregateSkills:  aggregateSkills,
		CreatedAt:        now.UTC(),
	}, events, snapshot, badges)
	if err != nil {
		return contracts.ReplayUserScoresResponse{}, err
	}

	response := contracts.ReplayUserScoresResponse{
		Snapshot: snapshotToContract(savedSnapshot, run),
		Badges:   badgeAwardsToViews(badges),
		Events:   len(events),
	}
	return response, nil
}

func (s *Service) VerifyReplay(ctx context.Context, userID string, req contracts.VerifyScoreReplayRequest, now time.Time) (contracts.ScoreReplayVerificationResponse, error) {
	if s == nil || s.store == nil || s.store.pool == nil {
		return contracts.ScoreReplayVerificationResponse{}, ErrUnavailable
	}
	if strings.TrimSpace(userID) == "" {
		return contracts.ScoreReplayVerificationResponse{}, ErrInvalidRequest
	}
	if err := req.Validate(); err != nil {
		return contracts.ScoreReplayVerificationResponse{}, fmt.Errorf("%w: %v", ErrInvalidRequest, err)
	}
	if version := strings.TrimSpace(req.ScoreVersion); version != "" && version != s.scoreVersion() {
		return contracts.ScoreReplayVerificationResponse{}, fmt.Errorf("%w: score_version must be %s", ErrInvalidRequest, s.scoreVersion())
	}
	if err := s.store.EnsureUser(ctx, userID); err != nil {
		return contracts.ScoreReplayVerificationResponse{}, err
	}

	repository := strings.TrimSpace(req.Repository)
	if repository != "" {
		normalized, err := contracts.NormalizeGitHubRepository(repository)
		if err != nil {
			return contracts.ScoreReplayVerificationResponse{}, err
		}
		repository = normalized
	}

	candidates, err := s.store.LoadReplayCandidatesFiltered(ctx, userID, replayCandidateFilter{
		Repository: repository,
		From:       req.From,
		To:         req.To,
	})
	if err != nil {
		return contracts.ScoreReplayVerificationResponse{}, err
	}

	events, snapshot, badges, _, sourceWatermark := s.buildReplay(userID, "verification", candidates, now.UTC())
	return contracts.ScoreReplayVerificationResponse{
		UserID:            userID,
		ScoreVersion:      s.scoreVersion(),
		Repository:        repository,
		From:              optionalUTCTime(req.From),
		To:                optionalUTCTime(req.To),
		TotalXP:           snapshot.TotalXP,
		Level:             snapshot.Level,
		RankTier:          snapshot.RankTier,
		TopSkills:         snapshot.TopSkills,
		Badges:            badgeAwardsToViews(badges),
		Events:            scoreEventsToViews(events),
		ContributionCount: len(events),
		SuspiciousEvents:  snapshot.SuspiciousEvents,
		SourceWatermark:   sourceWatermark.UTC(),
		GeneratedAt:       now.UTC(),
		Persisted:         false,
	}, nil
}

func (s *Service) scoreVersion() string {
	version := strings.TrimSpace(s.cfg.Scoring.ScoreVersion)
	if version == "" {
		return scoring.DefaultScoreVersion
	}
	return version
}

func optionalUTCTime(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	utc := value.UTC()
	return &utc
}

func (s *Service) LatestSnapshot(ctx context.Context, userID string, now time.Time) (contracts.UserScoreSnapshotResponse, error) {
	if s == nil || s.store == nil || s.store.pool == nil {
		return contracts.UserScoreSnapshotResponse{}, ErrUnavailable
	}
	if strings.TrimSpace(userID) == "" {
		return contracts.UserScoreSnapshotResponse{}, ErrInvalidRequest
	}
	if err := s.store.EnsureUser(ctx, userID); err != nil {
		return contracts.UserScoreSnapshotResponse{}, err
	}

	run, snapshot, err := s.store.LoadLatestSnapshot(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		replayed, replayErr := s.ReplayUser(ctx, userID, contracts.ReplayUserScoresRequest{TriggerType: "replay"}, now.UTC())
		if replayErr != nil {
			return contracts.UserScoreSnapshotResponse{}, replayErr
		}
		return replayed.Snapshot, nil
	}
	if err != nil {
		return contracts.UserScoreSnapshotResponse{}, err
	}
	return snapshotToContract(snapshot, run), nil
}

func (s *Service) Events(ctx context.Context, userID string, now time.Time) (contracts.UserScoreEventsResponse, error) {
	if s == nil || s.store == nil || s.store.pool == nil {
		return contracts.UserScoreEventsResponse{}, ErrUnavailable
	}
	if strings.TrimSpace(userID) == "" {
		return contracts.UserScoreEventsResponse{}, ErrInvalidRequest
	}
	if err := s.store.EnsureUser(ctx, userID); err != nil {
		return contracts.UserScoreEventsResponse{}, err
	}

	run, err := s.store.LoadLatestReplayRun(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		if _, replayErr := s.ReplayUser(ctx, userID, contracts.ReplayUserScoresRequest{TriggerType: "replay"}, now.UTC()); replayErr != nil {
			return contracts.UserScoreEventsResponse{}, replayErr
		}
		run, err = s.store.LoadLatestReplayRun(ctx, userID)
	}
	if err != nil {
		return contracts.UserScoreEventsResponse{}, err
	}

	events, err := s.store.LoadEventsForReplayRun(ctx, run.ID)
	if err != nil {
		return contracts.UserScoreEventsResponse{}, err
	}
	return contracts.UserScoreEventsResponse{
		ReplayRunID:  run.ID,
		UserID:       userID,
		ScoreVersion: run.ScoreVersion,
		Events:       events,
	}, nil
}

type historicalContribution struct {
	OccurredAt time.Time
	Repository string
	Category   string
	TotalXP    int
	Meaningful bool
	Merged     bool
}

func (s *Service) buildReplay(userID, triggerType string, candidates []replayCandidate, now time.Time) ([]scoreEventRecord, scoreSnapshotRecord, []badgeAward, map[string]int, time.Time) {
	history := make([]historicalContribution, 0, len(candidates))
	events := make([]scoreEventRecord, 0, len(candidates))
	aggregateSkills := make(map[string]int)
	totalXP := 0
	suspicious := 0
	sourceWatermark := now.UTC()

	for _, candidate := range candidates {
		if candidate.OccurredAt.After(sourceWatermark) {
			sourceWatermark = candidate.OccurredAt.UTC()
		}
		if candidate.AnalysisCreatedAt.After(sourceWatermark) {
			sourceWatermark = candidate.AnalysisCreatedAt.UTC()
		}

		analysis := buildReplayAnalysis(candidate, s.cfg.Scoring)
		response := s.engine.Score(contracts.ScoreContributionRequest{
			Repository:  candidate.Repository,
			PullRequest: candidate.PullRequest,
			Analysis:    analysis,
			Contributor: deriveContributorContext(history, candidate),
		})
		rawFormulaTotalXP := response.TotalXP
		selfMerged := candidate.SelfMerged()
		if selfMerged {
			response.TotalXP = 0
			response.SkillXP = map[string]int{}
			response.Explanation = append(response.Explanation, "self-merged pull request excluded from score")
			response.SuspiciousActivity = true
		}
		formulaVersion := "score-components/" + response.ScoreVersion

		event := scoreEventRecord{
			EventKey:      fmt.Sprintf("pr:%s:analysis:%s:score:%s", candidate.PullRequestID, candidate.AnalysisID, response.ScoreVersion),
			ScoreVersion:  response.ScoreVersion,
			EventType:     "score.computed",
			PullRequestID: candidate.PullRequestID,
			AnalysisID:    candidate.AnalysisID,
			DeltaXP:       response.TotalXP,
			SkillXP:       response.SkillXP,
			Explanation:   append([]string{}, response.Explanation...),
			Metadata: map[string]any{
				"category":                     analysis.Category,
				"analysis_source":              analysis.AnalysisSource,
				"confidence":                   analysis.Confidence,
				"suspicious":                   response.SuspiciousActivity,
				"trigger_type":                 triggerType,
				"technical_depth":              analysis.TechnicalDepth,
				"review_strength":              analysis.ReviewStrength,
				"category_weight":              response.CategoryWeight,
				"repository_weight":            response.RepositoryWeight,
				"outcome_weight":               response.OutcomeWeight,
				"consistency_modifier":         response.ConsistencyModifier,
				"diminishing_returns":          response.DiminishingReturnsModifier,
				"diminishing_returns_modifier": response.DiminishingReturnsModifier,
				"spam_penalty":                 response.SpamPenalty,
				"total_xp":                     response.TotalXP,
				"raw_formula_total_xp":         rawFormulaTotalXP,
				"level":                        response.Level,
				"score_formula_inputs_version": formulaVersion,
				"formula_version":              formulaVersion,
				"pull_request_id":              candidate.PullRequestID,
				"analysis_id":                  candidate.AnalysisID,
				"repository_full_name":         candidate.Repository.FullName,
				"merged":                       candidate.PullRequest.Merged,
				"self_merged":                  selfMerged,
			},
			CreatedAt:  candidate.OccurredAt.UTC(),
			Suspicious: response.SuspiciousActivity,
			Repository: candidate.Repository.FullName,
			PRNumber:   candidate.PullRequest.Number,
			PRTitle:    candidate.PullRequest.Title,
		}
		events = append(events, event)
		totalXP += response.TotalXP
		if response.SuspiciousActivity {
			suspicious++
		}
		for key, value := range response.SkillXP {
			aggregateSkills[key] += value
		}
		history = append(history, historicalContribution{
			OccurredAt: candidate.OccurredAt.UTC(),
			Repository: candidate.Repository.FullName,
			Category:   analysis.Category,
			TotalXP:    response.TotalXP,
			Meaningful: response.TotalXP >= 80 && !response.SuspiciousActivity,
			Merged:     candidate.PullRequest.Merged,
		})
	}

	badges := issueBadges(events, aggregateSkills, s.cfg.Scoring)
	snapshot := scoreSnapshotRecord{
		UserID:            userID,
		ScoreVersion:      s.scoreVersion(),
		TriggerType:       triggerType,
		TotalXP:           totalXP,
		Level:             s.engine.LevelForXP(totalXP),
		RankTier:          rankTierForXP(totalXP, s.cfg.Scoring),
		TopSkills:         buildSkillAreas(aggregateSkills),
		BadgeKeys:         badgeKeys(badges),
		ContributionCount: len(events),
		SuspiciousEvents:  suspicious,
		SourceWatermark:   sourceWatermark.UTC(),
		ComputedAt:        now.UTC(),
	}
	return events, snapshot, badges, aggregateSkills, sourceWatermark.UTC()
}

func (c replayCandidate) SelfMerged() bool {
	if !c.PullRequest.Merged {
		return false
	}
	author := strings.ToLower(strings.TrimSpace(c.AuthorLogin))
	mergedBy := strings.ToLower(strings.TrimSpace(c.MergedByLogin))
	return author != "" && mergedBy != "" && author == mergedBy
}

func buildReplayAnalysis(candidate replayCandidate, policy config.Scoring) contracts.PullRequestAnalysisResponse {
	breakdown := deriveFileBreakdown(candidate.PullRequest.Files)
	languages := deriveDetectedLanguages(candidate.PullRequest.Files, candidate.Repository.PrimaryLanguage, candidate.SignalHints)
	criticality := deriveCriticalityTags(candidate.PullRequest.Files, candidate.SignalHints)
	category := candidate.Classification
	if category == "" {
		category = "feature"
	}
	return contracts.PullRequestAnalysisResponse{
		SchemaVersion:           contracts.PullRequestAnalysisSchemaVersion,
		AnalyzerVersion:         candidate.AnalyzerVersion,
		AnalysisSource:          defaultString(candidate.AnalysisSource, contracts.AnalysisSourceDeterministic),
		PromptVersion:           candidate.PromptVersion,
		ModelName:               candidate.ModelName,
		ValidationStatus:        contracts.AnalysisValidationValidated,
		Category:                category,
		Summary:                 candidate.Summary,
		Confidence:              candidate.Confidence,
		TechnicalDepth:          deriveTechnicalDepth(candidate.PullRequest, breakdown, criticality, policy),
		ReviewStrength:          deriveReviewStrength(candidate.PullRequest.Reviews, policy),
		DetectedLanguages:       languages,
		PrimaryDetectedLanguage: primaryLanguage(languages, candidate.Repository.PrimaryLanguage),
		CriticalityTags:         criticality,
		IssueReferences:         deriveIssueReferences(candidate.PullRequest),
		ReviewCycles:            deriveReviewCycles(candidate.PullRequest.Reviews),
		Signals:                 append([]string{}, candidate.SignalHints...),
		Skills:                  deriveSkills(category, breakdown, criticality, languages),
		FileBreakdown:           breakdown,
	}
}

func deriveContributorContext(history []historicalContribution, candidate replayCandidate) contracts.ContributorContext {
	currentWeek := startOfWeek(candidate.OccurredAt.UTC())
	totalMeaningful := 0
	recentMerged := 0
	recentRepo := 0
	recentCategory := 0
	recentSimilar := 0
	weeks := make(map[time.Time]struct{})

	for _, prior := range history {
		if prior.Merged {
			recentMerged++
		}
		if prior.Meaningful {
			totalMeaningful++
		}
		weeks[startOfWeek(prior.OccurredAt.UTC())] = struct{}{}
		if candidate.OccurredAt.Sub(prior.OccurredAt) <= 60*24*time.Hour {
			if strings.EqualFold(prior.Repository, candidate.Repository.FullName) {
				recentRepo++
			}
			if prior.Category == candidate.Classification {
				recentCategory++
			}
			if strings.EqualFold(prior.Repository, candidate.Repository.FullName) && prior.Category == candidate.Classification {
				recentSimilar++
			}
		}
	}

	meaningfulRatio := 0.0
	if len(history) > 0 {
		meaningfulRatio = float64(totalMeaningful) / float64(len(history))
	}

	return contracts.ContributorContext{
		RecentMergedPullRequests:     recentMerged,
		ConsecutiveActiveWeeks:       consecutiveActiveWeeks(weeks, currentWeek),
		MeaningfulContributionRatio:  meaningfulRatio,
		RecentRepositoryPullRequests: recentRepo,
		RecentCategoryPullRequests:   recentCategory,
		RecentSimilarPullRequests:    recentSimilar,
	}
}

func consecutiveActiveWeeks(weeks map[time.Time]struct{}, currentWeek time.Time) int {
	if len(weeks) == 0 {
		return 0
	}
	count := 0
	for week := currentWeek; ; week = week.AddDate(0, 0, -7) {
		if _, ok := weeks[week]; !ok {
			break
		}
		count++
	}
	return count
}

func deriveFileBreakdown(files []contracts.ChangedFile) contracts.FileBreakdown {
	var breakdown contracts.FileBreakdown
	for _, file := range files {
		switch classifyFile(file.Path) {
		case "docs":
			breakdown.Docs++
		case "tests":
			breakdown.Tests++
		case "infra":
			breakdown.Infra++
		case "config":
			breakdown.Config++
		default:
			breakdown.Source++
		}
	}
	return breakdown
}

func deriveDetectedLanguages(files []contracts.ChangedFile, fallback string, signalHints []string) []string {
	counts := make(map[string]int)
	for _, hint := range signalHints {
		if strings.HasPrefix(hint, "languages=") {
			for _, value := range strings.Split(strings.TrimPrefix(hint, "languages="), ",") {
				trimmed := strings.TrimSpace(value)
				if trimmed != "" {
					counts[trimmed]++
				}
			}
		}
	}
	for _, file := range files {
		if language := languageForPath(file.Path); language != "" {
			counts[language]++
		}
	}
	if len(counts) == 0 && strings.TrimSpace(fallback) != "" {
		counts[strings.TrimSpace(fallback)]++
	}
	return sortCountKeys(counts)
}

func deriveCriticalityTags(files []contracts.ChangedFile, signalHints []string) []string {
	set := make(map[string]struct{})
	for _, hint := range signalHints {
		if strings.HasPrefix(hint, "criticality=") {
			for _, value := range strings.Split(strings.TrimPrefix(hint, "criticality="), ",") {
				if trimmed := strings.TrimSpace(value); trimmed != "" {
					set[trimmed] = struct{}{}
				}
			}
		}
	}
	for _, file := range files {
		lower := strings.ToLower(file.Path)
		switch {
		case strings.Contains(lower, "/auth") || strings.Contains(lower, "oauth") || strings.Contains(lower, "session") || strings.Contains(lower, "token"):
			set["auth_identity"] = struct{}{}
		case strings.Contains(lower, "/api") || strings.Contains(lower, "router") || strings.Contains(lower, "httpapi") || strings.Contains(lower, "openapi"):
			set["api_surface"] = struct{}{}
		case strings.Contains(lower, ".github/workflows") || strings.Contains(lower, "deploy") || strings.Contains(lower, "k8s") || strings.Contains(lower, "dockerfile"):
			set["delivery_pipeline"] = struct{}{}
		case strings.Contains(lower, "migration") || strings.Contains(lower, ".sql") || strings.Contains(lower, "schema"):
			set["data_model"] = struct{}{}
		case strings.Contains(lower, "security") || strings.Contains(lower, "crypto") || strings.Contains(lower, "permission"):
			set["security_sensitive"] = struct{}{}
		}
	}
	return sortSet(set)
}

func deriveIssueReferences(pr contracts.PullRequestContext) []string {
	set := make(map[string]struct{})
	for _, linked := range pr.LinkedIssues {
		if trimmed := strings.TrimSpace(linked); trimmed != "" {
			set[trimmed] = struct{}{}
		}
	}
	return sortSet(set)
}

func deriveReviewCycles(reviews []contracts.ReviewSignal) int {
	cycles := 0
	for _, review := range reviews {
		if strings.EqualFold(review.State, "changes_requested") {
			cycles++
		}
	}
	if cycles == 0 && len(reviews) > 1 {
		return 1
	}
	return cycles
}

func deriveReviewStrength(reviews []contracts.ReviewSignal, policy config.Scoring) float64 {
	baseStrength := policy.ReviewStrengthBase
	if baseStrength <= 0 {
		baseStrength = 0.8
	}
	commentedBonus := policy.ReviewStrengthCommentedBonus
	if commentedBonus < 0 {
		commentedBonus = 0.05
	}
	approvedBonus := policy.ReviewStrengthApprovedBonus
	if approvedBonus < 0 {
		approvedBonus = 0.12
	}
	approvedCap := policy.ReviewStrengthApprovedCap
	if approvedCap <= 0 {
		approvedCap = 3
	}
	changesBonus := policy.ReviewStrengthChangesBonus
	if changesBonus < 0 {
		changesBonus = 0.18
	}
	changesCap := policy.ReviewStrengthChangesCap
	if changesCap <= 0 {
		changesCap = 2
	}
	denseThreshold := policy.ReviewStrengthDenseThreshold
	if denseThreshold <= 0 {
		denseThreshold = 4
	}
	denseBonus := policy.ReviewStrengthDenseBonus
	if denseBonus < 0 {
		denseBonus = 0.1
	}
	maxStrength := policy.ReviewStrengthMax
	if maxStrength < baseStrength {
		maxStrength = baseStrength
	}

	strength := baseStrength
	approvals := 0
	changes := 0
	for _, review := range reviews {
		switch strings.ToLower(strings.TrimSpace(review.State)) {
		case "approved":
			approvals++
		case "changes_requested":
			changes++
		case "commented":
			strength += commentedBonus
		}
	}
	strength += float64(min(approvals, approvedCap)) * approvedBonus
	strength += float64(min(changes, changesCap)) * changesBonus
	if len(reviews) >= denseThreshold {
		strength += denseBonus
	}
	if strength > maxStrength {
		return maxStrength
	}
	return strength
}

func deriveTechnicalDepth(pr contracts.PullRequestContext, breakdown contracts.FileBreakdown, criticality []string, policy config.Scoring) float64 {
	baseDepth := policy.TechnicalDepthBase
	if baseDepth <= 0 {
		baseDepth = 0.75
	}
	sourceBonus := policy.TechnicalDepthSourceBonus
	if sourceBonus < 0 {
		sourceBonus = 0.2
	}
	testsBonus := policy.TechnicalDepthTestsBonus
	if testsBonus < 0 {
		testsBonus = 0.12
	}
	infraConfigBonus := policy.TechnicalDepthInfraConfigBonus
	if infraConfigBonus < 0 {
		infraConfigBonus = 0.08
	}
	crossSurfaceBonus := policy.TechnicalDepthCrossSurfaceBonus
	if crossSurfaceBonus < 0 {
		crossSurfaceBonus = 0.12
	}
	changedFilesMin := policy.TechnicalDepthChangedFilesMin
	if changedFilesMin <= 0 {
		changedFilesMin = 5
	}
	changedFilesBonus := policy.TechnicalDepthChangedFilesBonus
	if changedFilesBonus < 0 {
		changedFilesBonus = 0.12
	}
	changeVolumeMin := policy.TechnicalDepthChangeVolumeMin
	if changeVolumeMin <= 0 {
		changeVolumeMin = 200
	}
	changeVolumeBonus := policy.TechnicalDepthChangeVolumeBonus
	if changeVolumeBonus < 0 {
		changeVolumeBonus = 0.15
	}
	criticalityCap := policy.TechnicalDepthCriticalityCap
	if criticalityCap <= 0 {
		criticalityCap = 3
	}
	criticalityBonus := policy.TechnicalDepthCriticalityBonus
	if criticalityBonus < 0 {
		criticalityBonus = 0.08
	}
	maxDepth := policy.TechnicalDepthMax
	if maxDepth < baseDepth {
		maxDepth = baseDepth
	}

	depth := baseDepth
	if breakdown.Source > 0 {
		depth += sourceBonus
	}
	if breakdown.Tests > 0 {
		depth += testsBonus
	}
	if breakdown.Infra > 0 || breakdown.Config > 0 {
		depth += infraConfigBonus
	}
	if breakdown.Source > 0 && (breakdown.Tests > 0 || breakdown.Infra > 0 || breakdown.Config > 0) {
		depth += crossSurfaceBonus
	}
	if pr.ChangedFiles >= changedFilesMin {
		depth += changedFilesBonus
	}
	if pr.Additions+pr.Deletions >= changeVolumeMin {
		depth += changeVolumeBonus
	}
	depth += float64(min(len(criticality), criticalityCap)) * criticalityBonus
	if depth > maxDepth {
		return maxDepth
	}
	return depth
}

func deriveSkills(category string, breakdown contracts.FileBreakdown, criticality, languages []string) []string {
	set := make(map[string]struct{})
	switch category {
	case "documentation":
		set["documentation"] = struct{}{}
	case "tests":
		set["testing"] = struct{}{}
	case "bug_fix":
		set["debugging"] = struct{}{}
		set["backend"] = struct{}{}
	case "feature":
		set["backend"] = struct{}{}
	case "refactor":
		set["architecture"] = struct{}{}
	case "performance":
		set["performance"] = struct{}{}
		set["backend"] = struct{}{}
	case "infrastructure":
		set["tooling"] = struct{}{}
		set["systems"] = struct{}{}
	case "security":
		set["security"] = struct{}{}
		set["backend"] = struct{}{}
	case "maintainer_design":
		set["architecture"] = struct{}{}
		set["review"] = struct{}{}
	}
	if breakdown.Tests > 0 {
		set["testing"] = struct{}{}
	}
	for _, tag := range criticality {
		switch tag {
		case "api_surface":
			set["api_design"] = struct{}{}
		case "delivery_pipeline":
			set["tooling"] = struct{}{}
		case "security_sensitive", "auth_identity":
			set["security"] = struct{}{}
		case "data_model":
			set["systems"] = struct{}{}
		}
	}
	for _, language := range languages {
		switch strings.ToLower(language) {
		case "typescript", "javascript", "tsx", "jsx":
			set["frontend"] = struct{}{}
		}
	}
	return sortSet(set)
}

func issueBadges(events []scoreEventRecord, aggregateSkills map[string]int, policy config.Scoring) []badgeAward {
	repositoryMin := policy.BadgeMultiRepoRepositoryMin
	if repositoryMin <= 0 {
		repositoryMin = 3
	}
	securityXPMin := policy.BadgeSecurityXPMin
	if securityXPMin <= 0 {
		securityXPMin = 120
	}
	testingXPMin := policy.BadgeTestingXPMin
	if testingXPMin <= 0 {
		testingXPMin = 100
	}
	consistencyWeeksMin := policy.BadgeConsistencyWeeksMin
	if consistencyWeeksMin <= 0 {
		consistencyWeeksMin = 4
	}
	evidencePRLimit := policy.BadgeEvidencePRLimit
	if evidencePRLimit <= 0 {
		evidencePRLimit = 5
	}

	badges := make([]badgeAward, 0, 5)
	repositories := make(map[string]struct{})
	activeWeeks := make(map[time.Time]struct{})
	firstMergedAt := time.Time{}
	var firstMergedEvent *scoreEventRecord

	for _, event := range events {
		if event.Suspicious {
			continue
		}
		repositories[event.Repository] = struct{}{}
		activeWeeks[startOfWeek(event.CreatedAt)] = struct{}{}
		if merged, _ := event.Metadata["merged"].(bool); merged && (firstMergedAt.IsZero() || event.CreatedAt.Before(firstMergedAt)) {
			firstMergedAt = event.CreatedAt.UTC()
			eventCopy := event
			firstMergedEvent = &eventCopy
		}
	}

	if firstMergedEvent != nil {
		badges = append(badges, badgeAward{
			Key:       "first_merged_pr",
			AwardedAt: firstMergedAt.UTC(),
			Evidence: map[string]any{
				"issuer":          "scoring-engine",
				"rule":            "first_merged_pr",
				"rule_version":    "badges/v1",
				"awarded_for":     "first accepted scored contribution",
				"evidence_pr_ids": []string{firstMergedEvent.PullRequestID},
				"evidence_prs":    badgeEvidenceEvents([]scoreEventRecord{*firstMergedEvent}, evidencePRLimit),
			},
		})
	}
	if len(repositories) >= repositoryMin {
		badges = append(badges, badgeAward{
			Key:       "multi_repo_operator",
			AwardedAt: latestEventAt(events),
			Evidence: map[string]any{
				"issuer":            "scoring-engine",
				"rule":              "multi_repo_operator",
				"rule_version":      "badges/v1",
				"repository_count":  len(repositories),
				"contribution_span": len(events),
				"evidence_pr_ids":   badgeEvidencePRIDs(events, evidencePRLimit),
				"evidence_prs":      badgeEvidenceEvents(events, evidencePRLimit),
			},
		})
	}
	if aggregateSkills["security"] >= securityXPMin {
		badges = append(badges, badgeAward{
			Key:       "security_signal_1",
			AwardedAt: latestEventAt(events),
			Evidence: map[string]any{
				"issuer":          "scoring-engine",
				"rule":            "security_signal_1",
				"rule_version":    "badges/v1",
				"security_xp":     aggregateSkills["security"],
				"evidence_pr_ids": badgeEvidencePRIDs(skillEvents(events, "security"), evidencePRLimit),
				"evidence_prs":    badgeEvidenceEvents(skillEvents(events, "security"), evidencePRLimit),
			},
		})
	}
	if aggregateSkills["testing"] >= testingXPMin {
		badges = append(badges, badgeAward{
			Key:       "test_builder",
			AwardedAt: latestEventAt(events),
			Evidence: map[string]any{
				"issuer":          "scoring-engine",
				"rule":            "test_builder",
				"rule_version":    "badges/v1",
				"testing_xp":      aggregateSkills["testing"],
				"evidence_pr_ids": badgeEvidencePRIDs(skillEvents(events, "testing"), evidencePRLimit),
				"evidence_prs":    badgeEvidenceEvents(skillEvents(events, "testing"), evidencePRLimit),
			},
		})
	}
	if longestWeekStreak(activeWeeks) >= consistencyWeeksMin {
		badges = append(badges, badgeAward{
			Key:       "consistency_4w",
			AwardedAt: latestEventAt(events),
			Evidence: map[string]any{
				"issuer":          "scoring-engine",
				"rule":            "consistency_4w",
				"rule_version":    "badges/v1",
				"active_weeks":    longestWeekStreak(activeWeeks),
				"evidence_pr_ids": badgeEvidencePRIDs(events, evidencePRLimit),
				"evidence_prs":    badgeEvidenceEvents(events, evidencePRLimit),
			},
		})
	}
	return badges
}

func skillEvents(events []scoreEventRecord, skill string) []scoreEventRecord {
	out := make([]scoreEventRecord, 0, len(events))
	for _, event := range events {
		if event.Suspicious {
			continue
		}
		if event.SkillXP[skill] > 0 {
			out = append(out, event)
		}
	}
	return out
}

func badgeEvidencePRIDs(events []scoreEventRecord, limit int) []string {
	refs := badgeEvidenceEvents(events, limit)
	out := make([]string, 0, len(refs))
	for _, ref := range refs {
		if id, _ := ref["pull_request_id"].(string); id != "" {
			out = append(out, id)
		}
	}
	return out
}

func badgeEvidenceEvents(events []scoreEventRecord, limit int) []map[string]any {
	if limit <= 0 {
		limit = 5
	}
	out := make([]map[string]any, 0, min(len(events), limit))
	for _, event := range events {
		if event.Suspicious || event.PullRequestID == "" {
			continue
		}
		out = append(out, map[string]any{
			"score_event_key": event.EventKey,
			"pull_request_id": event.PullRequestID,
			"repository":      event.Repository,
			"number":          event.PRNumber,
			"title":           event.PRTitle,
			"delta_xp":        event.DeltaXP,
			"created_at":      event.CreatedAt.UTC().Format(time.RFC3339),
		})
		if len(out) >= limit {
			break
		}
	}
	return out
}

func longestWeekStreak(weeks map[time.Time]struct{}) int {
	if len(weeks) == 0 {
		return 0
	}
	ordered := make([]time.Time, 0, len(weeks))
	for week := range weeks {
		ordered = append(ordered, week)
	}
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].Before(ordered[j]) })
	best := 1
	current := 1
	for i := 1; i < len(ordered); i++ {
		if ordered[i].Sub(ordered[i-1]) == 7*24*time.Hour {
			current++
		} else {
			current = 1
		}
		if current > best {
			best = current
		}
	}
	return best
}

func latestEventAt(events []scoreEventRecord) time.Time {
	latest := time.Time{}
	for _, event := range events {
		if event.CreatedAt.After(latest) {
			latest = event.CreatedAt.UTC()
		}
	}
	return latest
}

func buildSkillAreas(skillTotals map[string]int) []contracts.SkillAreaView {
	total := 0
	for _, value := range skillTotals {
		total += value
	}
	out := make([]contracts.SkillAreaView, 0, len(skillTotals))
	for key, value := range skillTotals {
		percentage := 0.0
		if total > 0 {
			percentage = float64(value) * 100 / float64(total)
		}
		out = append(out, contracts.SkillAreaView{
			Key:        key,
			TotalXP:    value,
			Percentage: percentage,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].TotalXP == out[j].TotalXP {
			return out[i].Key < out[j].Key
		}
		return out[i].TotalXP > out[j].TotalXP
	})
	return out
}

func badgeKeys(badges []badgeAward) []string {
	out := make([]string, 0, len(badges))
	for _, badge := range badges {
		out = append(out, badge.Key)
	}
	return out
}

func badgeAwardsToViews(badges []badgeAward) []contracts.BadgeView {
	out := make([]contracts.BadgeView, 0, len(badges))
	for _, badge := range badges {
		out = append(out, contracts.BadgeView{
			Key:         badge.Key,
			Name:        humanizeBadgeKey(badge.Key),
			Description: badgeDescription(badge.Key),
			AwardedAt:   badge.AwardedAt.UTC(),
			Evidence:    badge.Evidence,
		})
	}
	return out
}

func scoreEventsToViews(events []scoreEventRecord) []contracts.ScoreEventView {
	out := make([]contracts.ScoreEventView, 0, len(events))
	for _, event := range events {
		view := contracts.ScoreEventView{
			EventKey:     event.EventKey,
			ScoreVersion: event.ScoreVersion,
			EventType:    event.EventType,
			DeltaXP:      event.DeltaXP,
			SkillXP:      event.SkillXP,
			Explanation:  append([]string{}, event.Explanation...),
			Suspicious:   event.Suspicious,
			CreatedAt:    event.CreatedAt.UTC(),
		}
		if strings.TrimSpace(event.Repository) != "" && event.PRNumber > 0 {
			view.PullRequest = &contracts.PullRequestReference{
				Repository: event.Repository,
				Number:     event.PRNumber,
				Title:      event.PRTitle,
			}
		}
		out = append(out, view)
	}
	return out
}

func snapshotToContract(snapshot scoreSnapshotRecord, run replayRunRecord) contracts.UserScoreSnapshotResponse {
	return contracts.UserScoreSnapshotResponse{
		ReplayRunID:       snapshot.ReplayRunID,
		UserID:            snapshot.UserID,
		ScoreVersion:      snapshot.ScoreVersion,
		TriggerType:       run.TriggerType,
		TotalXP:           snapshot.TotalXP,
		Level:             snapshot.Level,
		RankTier:          snapshot.RankTier,
		TopSkills:         snapshot.TopSkills,
		BadgeKeys:         snapshot.BadgeKeys,
		ContributionCount: snapshot.ContributionCount,
		SuspiciousEvents:  snapshot.SuspiciousEvents,
		SourceWatermark:   run.SourceWatermark.UTC(),
		ComputedAt:        snapshot.ComputedAt.UTC(),
	}
}

func normalizeTriggerType(trigger string) string {
	switch strings.ToLower(strings.TrimSpace(trigger)) {
	case "backfill":
		return "backfill"
	case "live":
		return "live"
	default:
		return "replay"
	}
}

func rankTierForXP(totalXP int, policy config.Scoring) string {
	return policy.RankTierForXP(totalXP)
}

func startOfWeek(value time.Time) time.Time {
	value = value.UTC()
	offset := (int(value.Weekday()) + 6) % 7
	start := value.AddDate(0, 0, -offset)
	return time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
}

func classifyFile(path string) string {
	lower := strings.ToLower(strings.TrimSpace(path))
	switch {
	case strings.HasSuffix(lower, ".md"), strings.HasSuffix(lower, ".mdx"), strings.Contains(lower, "/docs/"), strings.HasPrefix(lower, "docs/"), strings.Contains(lower, "changelog"):
		return "docs"
	case strings.HasSuffix(lower, "_test.go"), strings.Contains(lower, "/test/"), strings.Contains(lower, "/tests/"), strings.Contains(lower, "/spec/"), strings.HasSuffix(lower, ".spec.ts"), strings.HasSuffix(lower, ".test.ts"):
		return "tests"
	case strings.Contains(lower, ".github/workflows"), strings.Contains(lower, "/deploy"), strings.Contains(lower, "/k8s/"), strings.Contains(lower, "/helm/"), strings.Contains(lower, "dockerfile"), strings.Contains(lower, "/terraform/"):
		return "infra"
	case strings.HasSuffix(lower, ".yaml"), strings.HasSuffix(lower, ".yml"), strings.HasSuffix(lower, ".json"), strings.HasSuffix(lower, ".toml"), strings.HasSuffix(lower, ".ini"), strings.HasSuffix(lower, ".env"), strings.HasSuffix(lower, ".sql"):
		return "config"
	default:
		return "source"
	}
}

func languageForPath(path string) string {
	lower := strings.ToLower(strings.TrimSpace(path))
	switch {
	case strings.HasSuffix(lower, ".go"):
		return "Go"
	case strings.HasSuffix(lower, ".ts"), strings.HasSuffix(lower, ".tsx"):
		return "TypeScript"
	case strings.HasSuffix(lower, ".js"), strings.HasSuffix(lower, ".jsx"):
		return "JavaScript"
	case strings.HasSuffix(lower, ".py"):
		return "Python"
	case strings.HasSuffix(lower, ".rb"):
		return "Ruby"
	case strings.HasSuffix(lower, ".java"):
		return "Java"
	case strings.HasSuffix(lower, ".rs"):
		return "Rust"
	case strings.HasSuffix(lower, ".sql"):
		return "SQL"
	default:
		return ""
	}
}

func primaryLanguage(languages []string, fallback string) string {
	if len(languages) > 0 {
		return languages[0]
	}
	return strings.TrimSpace(fallback)
}

func sortSet(values map[string]struct{}) []string {
	out := make([]string, 0, len(values))
	for value := range values {
		out = append(out, value)
	}
	sort.Strings(out)
	return out
}

func sortCountKeys(values map[string]int) []string {
	out := make([]string, 0, len(values))
	for value := range values {
		out = append(out, value)
	}
	sort.Slice(out, func(i, j int) bool {
		if values[out[i]] == values[out[j]] {
			return out[i] < out[j]
		}
		return values[out[i]] > values[out[j]]
	})
	return out
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func humanizeBadgeKey(key string) string {
	key = strings.TrimSpace(strings.ReplaceAll(key, "-", " "))
	key = strings.ReplaceAll(key, "_", " ")
	parts := strings.Fields(strings.ToLower(key))
	for i := range parts {
		if parts[i] != "" {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, " ")
}

func badgeDescription(key string) string {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "first_merged_pr":
		return "Awarded after the first accepted public contribution enters the score ledger."
	case "multi_repo_operator":
		return "Signals meaningful scored work spanning multiple public repositories."
	case "security_signal_1":
		return "Derived from repeated public security-related scoring evidence."
	case "test_builder":
		return "Awarded for sustained test-heavy scored contribution history."
	case "consistency_4w":
		return "Signals four active contribution weeks in the public score history."
	default:
		return "Evidence-backed achievement derived from scored contribution history."
	}
}
