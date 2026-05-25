package analyzer

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
)

const analyzerVersion = "deterministic.v1"
const aiSummaryPromptVersion = "gemini.summary.v1"

type AIConfig struct {
	Provider            string
	APIKey              string
	Model               string
	BaseURL             string
	RequestTimeout      time.Duration
	SummaryMaxRunes     int
	PromptFilePathLimit int
	AnalyzerPolicyJSON  string
}

type Service struct {
	summaryClient *geminiSummaryClient
	policy        AnalyzerPolicy
}

func New() Service {
	return Service{
		policy: defaultAnalyzerPolicy(),
	}
}

func NewWithAI(cfg AIConfig) Service {
	return Service{
		summaryClient: newGeminiSummaryClient(cfg),
		policy:        loadAnalyzerPolicy(cfg.AnalyzerPolicyJSON),
	}
}

func (s Service) Analyze(req contracts.PullRequestAnalysisRequest) (contracts.PullRequestAnalysisResponse, error) {
	return s.analyze(context.Background(), req)
}

func (s Service) analyze(ctx context.Context, req contracts.PullRequestAnalysisRequest) (contracts.PullRequestAnalysisResponse, error) {
	if err := req.Validate(); err != nil {
		return contracts.PullRequestAnalysisResponse{}, err
	}

	breakdown := classifyFiles(req.PullRequest.Files)
	features := deriveFeatures(req, breakdown)
	category := classifyCategory(req, breakdown, s.policy)
	confidence := categoryConfidence(category, breakdown, req.PullRequest, features, s.policy)
	depth := technicalDepth(req.PullRequest, breakdown, features, s.policy)
	review := reviewStrength(req.PullRequest.Reviews, features.reviewCycles, s.policy)
	signals := buildSignals(req, breakdown, category, features)
	skills := buildSkills(category, breakdown, s.policy)
	flags := buildFlags(req, breakdown, features, s.policy)
	summary := buildSummary(category, breakdown, req.PullRequest, req.Repository, review, features, s.policy)

	response := contracts.PullRequestAnalysisResponse{
		SchemaVersion:           contracts.PullRequestAnalysisSchemaVersion,
		AnalyzerVersion:         analyzerVersion,
		AnalysisSource:          contracts.AnalysisSourceDeterministic,
		ValidationStatus:        contracts.AnalysisValidationValidated,
		FallbackReason:          "ai_not_enabled",
		Category:                category,
		Summary:                 summary,
		Confidence:              confidence,
		TechnicalDepth:          depth,
		ReviewStrength:          review,
		DetectedLanguages:       features.detectedLanguages,
		PrimaryDetectedLanguage: features.primaryDetectedLanguage,
		CriticalityTags:         features.criticalityTags,
		IssueReferences:         features.issueReferences,
		ReviewCycles:            features.reviewCycles,
		Signals:                 signals,
		Skills:                  skills,
		Flags:                   flags,
		FileBreakdown:           breakdown,
	}
	if err := applyHallucinationGuardrails(req, breakdown, features, response, s.policy); err != nil {
		return contracts.PullRequestAnalysisResponse{}, errors.New("analysis response failed guardrails: " + err.Error())
	}
	if err := response.Validate(); err != nil {
		return contracts.PullRequestAnalysisResponse{}, errors.New("analysis response failed validation: " + err.Error())
	}

	if s.summaryClient == nil {
		return response, nil
	}

	aiSummary, err := s.summaryClient.Summarize(ctx, req, response)
	if err != nil {
		response.FallbackReason = aiFallbackReason(err)
		response.Signals = appendFallbackReasonSignal(response.Signals, response.FallbackReason)
		return response, nil
	}
	if strings.TrimSpace(aiSummary) == "" {
		response.FallbackReason = "ai_empty_summary"
		response.Signals = appendFallbackReasonSignal(response.Signals, response.FallbackReason)
		return response, nil
	}
	response.Summary = aiSummary
	response.AnalysisSource = contracts.AnalysisSourceHybrid
	response.PromptVersion = aiSummaryPromptVersion
	response.ModelName = s.summaryClient.model
	response.FallbackReason = ""

	if err := applyHallucinationGuardrails(req, breakdown, features, response, s.policy); err != nil {
		response.Summary = summary
		response.AnalysisSource = contracts.AnalysisSourceDeterministic
		response.PromptVersion = ""
		response.ModelName = ""
		response.FallbackReason = "ai_guardrail_rejected"
		response.Signals = appendFallbackReasonSignal(response.Signals, response.FallbackReason)
		return response, nil
	}
	if err := response.Validate(); err != nil {
		response.Summary = summary
		response.AnalysisSource = contracts.AnalysisSourceDeterministic
		response.PromptVersion = ""
		response.ModelName = ""
		response.FallbackReason = "ai_validation_failed"
		response.Signals = appendFallbackReasonSignal(response.Signals, response.FallbackReason)
		return response, nil
	}
	return response, nil
}

func aiFallbackReason(err error) string {
	var summaryErr *aiSummaryError
	if errors.As(err, &summaryErr) {
		reason := strings.TrimSpace(summaryErr.reason)
		if reason != "" {
			return reason
		}
	}
	return "ai_request_failed"
}

func appendFallbackReasonSignal(signals []string, reason string) []string {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return signals
	}
	signal := "fallback_reason=" + reason
	for _, existing := range signals {
		if strings.EqualFold(existing, signal) {
			return signals
		}
	}
	return append(signals, signal)
}

func classifyFiles(files []contracts.ChangedFile) contracts.FileBreakdown {
	var breakdown contracts.FileBreakdown
	for _, file := range files {
		path := strings.ToLower(file.Path)
		switch {
		case isInfraPath(path):
			breakdown.Infra++
		case isDocPath(path):
			breakdown.Docs++
		case isTestPath(path):
			breakdown.Tests++
		case isConfigPath(path):
			breakdown.Config++
		default:
			breakdown.Source++
		}
	}
	return breakdown
}

func classifyCategory(req contracts.PullRequestAnalysisRequest, breakdown contracts.FileBreakdown, policy AnalyzerPolicy) string {
	text := strings.ToLower(req.PullRequest.Title + " " + req.PullRequest.Body + " " + strings.Join(req.PullRequest.Labels, " "))

	switch {
	case hasAnyKeyword(text, policy.SecurityKeywords):
		return "security"
	case breakdown.Source == 0 && breakdown.Tests == 0 && breakdown.Docs > 0:
		return "documentation"
	case breakdown.Source == 0 && breakdown.Tests > 0:
		return "tests"
	case hasAnyKeyword(text, policy.PerformanceKeywords):
		return "performance"
	case hasAnyKeyword(text, policy.RefactorKeywords):
		return "refactor"
	case breakdown.Infra > 0 && breakdown.Source == 0:
		return "infrastructure"
	case hasAnyKeyword(text, policy.BugFixKeywords):
		return "bug_fix"
	case hasAnyKeyword(text, policy.MaintainerDesignKeywords):
		return "maintainer_design"
	default:
		return "feature"
	}
}

func categoryConfidence(category string, breakdown contracts.FileBreakdown, pr contracts.PullRequestContext, features derivedFeatures, policy AnalyzerPolicy) float64 {
	base := policy.ConfidenceBase
	if category == "documentation" && breakdown.Source == 0 {
		base += policy.ConfidenceDocsOnlyBonus
	}
	if breakdown.Source > 0 && pr.ChangedFiles > 0 {
		base += policy.ConfidenceSourceBonus
	}
	if len(pr.Labels) > 0 {
		base += policy.ConfidenceLabelsBonus
	}
	if len(features.issueReferences) > 0 {
		base += policy.ConfidenceIssueReferenceBonus
	}
	if len(features.criticalityTags) > 0 {
		base += policy.ConfidenceCriticalityBonus
	}
	if base > policy.ConfidenceMax {
		return policy.ConfidenceMax
	}
	return base
}

func technicalDepth(pr contracts.PullRequestContext, breakdown contracts.FileBreakdown, features derivedFeatures, policy AnalyzerPolicy) float64 {
	score := policy.DepthBase
	score += float64(min(pr.ChangedFiles, policy.DepthChangedFilesCap)) * policy.DepthChangedFilesBonus
	score += float64(min(pr.Commits, policy.DepthCommitsCap)) * policy.DepthCommitsBonus
	score += float64(min(pr.Additions+pr.Deletions, policy.DepthDiffLinesCap)) / policy.DepthDiffLinesDivisor
	score += float64(breakdown.Source) * policy.DepthSourceFilesBonus
	score += float64(breakdown.Tests) * policy.DepthTestFilesBonus
	if breakdown.Infra > 0 && breakdown.Source > 0 {
		score += policy.DepthInfraSourceBonus
	}
	score += float64(min(len(features.criticalityTags), policy.DepthCriticalityCap)) * policy.DepthCriticalityBonus
	if len(features.detectedLanguages) > 1 {
		score += policy.DepthPolyglotBonus
	}
	if pr.Draft {
		score -= policy.DepthDraftPenalty
	}
	if score < policy.DepthMin {
		return policy.DepthMin
	}
	if score > policy.DepthMax {
		return policy.DepthMax
	}
	return score
}

func reviewStrength(reviews []contracts.ReviewSignal, reviewCycles int, policy AnalyzerPolicy) float64 {
	score := policy.ReviewBase
	for _, review := range reviews {
		switch strings.ToLower(review.State) {
		case "approved":
			score += policy.ReviewApprovedBonus
		case "changes_requested":
			score += policy.ReviewChangesRequestedBonus
		case "commented":
			score += policy.ReviewCommentedBonus
		}

		if assoc := strings.ToLower(review.AuthorAssociation); assoc == "member" || assoc == "owner" || assoc == "collaborator" {
			score += policy.ReviewMaintainerAssociationAdd
		}
	}
	score += float64(min(reviewCycles, policy.ReviewCyclesCap)) * policy.ReviewCyclesBonus
	if score > policy.ReviewMax {
		return policy.ReviewMax
	}
	return score
}

func buildSignals(req contracts.PullRequestAnalysisRequest, breakdown contracts.FileBreakdown, category string, features derivedFeatures) []string {
	signals := []string{
		fmt.Sprintf("category=%s", category),
		fmt.Sprintf("files=%d", req.PullRequest.ChangedFiles),
		fmt.Sprintf("commits=%d", req.PullRequest.Commits),
	}

	if breakdown.Docs > 0 {
		signals = append(signals, fmt.Sprintf("docs_files=%d", breakdown.Docs))
	}
	if breakdown.Tests > 0 {
		signals = append(signals, fmt.Sprintf("test_files=%d", breakdown.Tests))
	}
	if breakdown.Source > 0 {
		signals = append(signals, fmt.Sprintf("source_files=%d", breakdown.Source))
	}
	if len(features.detectedLanguages) > 0 {
		signals = append(signals, "languages="+strings.Join(features.detectedLanguages, ","))
	}
	if len(features.issueReferences) > 0 {
		signals = append(signals, fmt.Sprintf("linked_issues=%d", len(features.issueReferences)))
	}
	if len(req.PullRequest.Reviews) > 0 {
		signals = append(signals, fmt.Sprintf("reviews=%d", len(req.PullRequest.Reviews)))
	}
	if features.reviewCycles > 0 {
		signals = append(signals, fmt.Sprintf("review_cycles=%d", features.reviewCycles))
	}
	if len(features.criticalityTags) > 0 {
		signals = append(signals, "criticality="+strings.Join(features.criticalityTags, ","))
	}

	return signals
}

func buildSkills(category string, breakdown contracts.FileBreakdown, policy AnalyzerPolicy) []string {
	skills := slices.Clone(policy.CategorySkills[category])
	if len(skills) == 0 {
		skills = slices.Clone(policy.CategorySkills["feature"])
	}

	if breakdown.Tests > 0 && !slices.Contains(skills, "testing") {
		skills = append(skills, "testing")
	}

	return skills
}

func buildFlags(req contracts.PullRequestAnalysisRequest, breakdown contracts.FileBreakdown, features derivedFeatures, policy AnalyzerPolicy) []string {
	var flags []string

	if req.PullRequest.Draft {
		flags = append(flags, "draft_pull_request")
	}
	if req.Repository.Archived {
		flags = append(flags, "archived_repository")
	}
	if req.PullRequest.ChangedFiles <= policy.SmallChangeMaxFiles &&
		req.PullRequest.Additions+req.PullRequest.Deletions <= policy.SmallChangeMaxDiffLines {
		flags = append(flags, "small_change")
	}
	if breakdown.Docs > 0 && breakdown.Source == 0 && breakdown.Tests == 0 {
		flags = append(flags, "docs_only")
	}
	if len(features.detectedLanguages) > 1 {
		flags = append(flags, "polyglot_change")
	}
	if features.reviewCycles > 0 {
		flags = append(flags, "review_rework_cycle")
	}
	if len(features.criticalityTags) > 0 {
		flags = append(flags, "critical_path_change")
	}

	return flags
}

func buildSummary(category string, breakdown contracts.FileBreakdown, pr contracts.PullRequestContext, repo contracts.RepositoryContext, review float64, features derivedFeatures, policy AnalyzerPolicy) string {
	parts := []string{
		strings.ReplaceAll(category, "_", " "),
		fmt.Sprintf("PR touching %d files", pr.ChangedFiles),
	}

	if breakdown.Source > 0 {
		parts = append(parts, fmt.Sprintf("%d source", breakdown.Source))
	}
	if breakdown.Tests > 0 {
		parts = append(parts, fmt.Sprintf("%d test", breakdown.Tests))
	}
	if breakdown.Docs > 0 {
		parts = append(parts, fmt.Sprintf("%d docs", breakdown.Docs))
	}
	if repo.PrimaryLanguage != "" {
		parts = append(parts, fmt.Sprintf("primary language %s", repo.PrimaryLanguage))
	}
	if features.primaryDetectedLanguage != "" && !strings.EqualFold(features.primaryDetectedLanguage, repo.PrimaryLanguage) {
		parts = append(parts, fmt.Sprintf("detected language %s", features.primaryDetectedLanguage))
	}
	if len(features.issueReferences) > 0 {
		parts = append(parts, fmt.Sprintf("linked issues %d", len(features.issueReferences)))
	}
	if review >= policy.ReviewMeaningfulThreshold {
		parts = append(parts, "meaningful review activity")
	}
	if features.reviewCycles > 0 {
		parts = append(parts, fmt.Sprintf("review rework cycles %d", features.reviewCycles))
	}
	if len(features.criticalityTags) > 0 {
		parts = append(parts, "critical path touched")
	}

	return strings.Join(parts, "; ")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
