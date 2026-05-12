package analyzer

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/gitrank/gitrank/packages/contracts"
)

const analyzerVersion = "deterministic.v1"

type Service struct{}

func New() Service {
	return Service{}
}

func (Service) Analyze(req contracts.PullRequestAnalysisRequest) (contracts.PullRequestAnalysisResponse, error) {
	if err := req.Validate(); err != nil {
		return contracts.PullRequestAnalysisResponse{}, err
	}

	breakdown := classifyFiles(req.PullRequest.Files)
	features := deriveFeatures(req, breakdown)
	category := classifyCategory(req, breakdown)
	confidence := categoryConfidence(category, breakdown, req.PullRequest, features)
	depth := technicalDepth(req.PullRequest, breakdown, features)
	review := reviewStrength(req.PullRequest.Reviews, features.reviewCycles)
	signals := buildSignals(req, breakdown, category, features)
	skills := buildSkills(category, breakdown)
	flags := buildFlags(req, breakdown, features)
	summary := buildSummary(category, breakdown, req.PullRequest, req.Repository, review, features)

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
	if err := applyHallucinationGuardrails(req, breakdown, features, response); err != nil {
		return contracts.PullRequestAnalysisResponse{}, errors.New("analysis response failed guardrails: " + err.Error())
	}
	if err := response.Validate(); err != nil {
		return contracts.PullRequestAnalysisResponse{}, errors.New("analysis response failed validation: " + err.Error())
	}
	return response, nil
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

func classifyCategory(req contracts.PullRequestAnalysisRequest, breakdown contracts.FileBreakdown) string {
	text := strings.ToLower(req.PullRequest.Title + " " + req.PullRequest.Body + " " + strings.Join(req.PullRequest.Labels, " "))

	switch {
	case strings.Contains(text, "security") || strings.Contains(text, "cve") || strings.Contains(text, "auth"):
		return "security"
	case breakdown.Source == 0 && breakdown.Tests == 0 && breakdown.Docs > 0:
		return "documentation"
	case breakdown.Source == 0 && breakdown.Tests > 0:
		return "tests"
	case strings.Contains(text, "performance") || strings.Contains(text, "latency") || strings.Contains(text, "optimiz"):
		return "performance"
	case strings.Contains(text, "refactor") || strings.Contains(text, "cleanup") || strings.Contains(text, "rename"):
		return "refactor"
	case breakdown.Infra > 0 && breakdown.Source == 0:
		return "infrastructure"
	case strings.Contains(text, "bug") || strings.Contains(text, "fix") || strings.Contains(text, "regression"):
		return "bug_fix"
	case strings.Contains(text, "design") || strings.Contains(text, "architecture"):
		return "maintainer_design"
	default:
		return "feature"
	}
}

func categoryConfidence(category string, breakdown contracts.FileBreakdown, pr contracts.PullRequestContext, features derivedFeatures) float64 {
	base := 0.6
	if category == "documentation" && breakdown.Source == 0 {
		base += 0.25
	}
	if breakdown.Source > 0 && pr.ChangedFiles > 0 {
		base += 0.1
	}
	if len(pr.Labels) > 0 {
		base += 0.05
	}
	if len(features.issueReferences) > 0 {
		base += 0.03
	}
	if len(features.criticalityTags) > 0 {
		base += 0.02
	}
	if base > 0.95 {
		return 0.95
	}
	return base
}

func technicalDepth(pr contracts.PullRequestContext, breakdown contracts.FileBreakdown, features derivedFeatures) float64 {
	score := 0.75
	score += float64(min(pr.ChangedFiles, 12)) * 0.04
	score += float64(min(pr.Commits, 8)) * 0.03
	score += float64(min(pr.Additions+pr.Deletions, 800)) / 1000
	score += float64(breakdown.Source) * 0.08
	score += float64(breakdown.Tests) * 0.05
	if breakdown.Infra > 0 && breakdown.Source > 0 {
		score += 0.15
	}
	score += float64(min(len(features.criticalityTags), 3)) * 0.05
	if len(features.detectedLanguages) > 1 {
		score += 0.08
	}
	if pr.Draft {
		score -= 0.2
	}
	if score < 0.5 {
		return 0.5
	}
	if score > 2.25 {
		return 2.25
	}
	return score
}

func reviewStrength(reviews []contracts.ReviewSignal, reviewCycles int) float64 {
	score := 0.85
	for _, review := range reviews {
		switch strings.ToLower(review.State) {
		case "approved":
			score += 0.12
		case "changes_requested":
			score += 0.08
		case "commented":
			score += 0.03
		}

		if assoc := strings.ToLower(review.AuthorAssociation); assoc == "member" || assoc == "owner" || assoc == "collaborator" {
			score += 0.05
		}
	}
	score += float64(min(reviewCycles, 3)) * 0.05
	if score > 1.5 {
		return 1.5
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

func buildSkills(category string, breakdown contracts.FileBreakdown) []string {
	var skills []string

	switch category {
	case "documentation":
		skills = append(skills, "documentation")
	case "tests":
		skills = append(skills, "testing")
	case "bug_fix":
		skills = append(skills, "debugging", "backend")
	case "feature":
		skills = append(skills, "backend", "api_design")
	case "refactor":
		skills = append(skills, "systems", "tooling")
	case "performance":
		skills = append(skills, "performance", "backend")
	case "infrastructure":
		skills = append(skills, "tooling", "systems")
	case "security":
		skills = append(skills, "security", "backend")
	case "maintainer_design":
		skills = append(skills, "systems", "api_design")
	}

	if breakdown.Tests > 0 && !slices.Contains(skills, "testing") {
		skills = append(skills, "testing")
	}

	return skills
}

func buildFlags(req contracts.PullRequestAnalysisRequest, breakdown contracts.FileBreakdown, features derivedFeatures) []string {
	var flags []string

	if req.PullRequest.Draft {
		flags = append(flags, "draft_pull_request")
	}
	if req.Repository.Archived {
		flags = append(flags, "archived_repository")
	}
	if req.PullRequest.ChangedFiles <= 2 && req.PullRequest.Additions+req.PullRequest.Deletions < 15 {
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

func buildSummary(category string, breakdown contracts.FileBreakdown, pr contracts.PullRequestContext, repo contracts.RepositoryContext, review float64, features derivedFeatures) string {
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
	if review >= 1.1 {
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
