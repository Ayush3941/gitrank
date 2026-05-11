package contracts

import (
	"errors"
	"fmt"
	"slices"
	"strings"
)

const (
	PullRequestAnalysisSchemaVersion = "pr-analysis.v1"

	AnalysisSourceDeterministic = "deterministic"
	AnalysisSourceAIAssisted    = "ai_assisted"
	AnalysisSourceHybrid        = "hybrid"

	AnalysisValidationValidated = "validated"
)

type PullRequestAnalysisRequest struct {
	Repository  RepositoryContext  `json:"repository"`
	PullRequest PullRequestContext `json:"pull_request"`
}

type RepositoryContext struct {
	FullName        string `json:"full_name"`
	PrimaryLanguage string `json:"primary_language,omitempty"`
	DefaultBranch   string `json:"default_branch,omitempty"`
	Stars           int    `json:"stars,omitempty"`
	Maintainers     int    `json:"maintainers,omitempty"`
	Archived        bool   `json:"archived,omitempty"`
}

type PullRequestContext struct {
	Number       int            `json:"number"`
	Title        string         `json:"title"`
	Body         string         `json:"body,omitempty"`
	State        string         `json:"state,omitempty"`
	Merged       bool           `json:"merged"`
	Draft        bool           `json:"draft"`
	Additions    int            `json:"additions"`
	Deletions    int            `json:"deletions"`
	ChangedFiles int            `json:"changed_files"`
	Commits      int            `json:"commits"`
	Labels       []string       `json:"labels,omitempty"`
	LinkedIssues []string       `json:"linked_issues,omitempty"`
	Files        []ChangedFile  `json:"files,omitempty"`
	Reviews      []ReviewSignal `json:"reviews,omitempty"`
}

type ChangedFile struct {
	Path      string `json:"path"`
	Additions int    `json:"additions,omitempty"`
	Deletions int    `json:"deletions,omitempty"`
	Status    string `json:"status,omitempty"`
}

type ReviewSignal struct {
	State             string `json:"state"`
	AuthorAssociation string `json:"author_association,omitempty"`
}

type PullRequestAnalysisResponse struct {
	SchemaVersion           string        `json:"schema_version,omitempty"`
	AnalyzerVersion         string        `json:"analyzer_version,omitempty"`
	AnalysisSource          string        `json:"analysis_source,omitempty"`
	PromptVersion           string        `json:"prompt_version,omitempty"`
	ModelName               string        `json:"model_name,omitempty"`
	ValidationStatus        string        `json:"validation_status,omitempty"`
	FallbackReason          string        `json:"fallback_reason,omitempty"`
	Category                string        `json:"category"`
	Summary                 string        `json:"summary"`
	Confidence              float64       `json:"confidence"`
	TechnicalDepth          float64       `json:"technical_depth"`
	ReviewStrength          float64       `json:"review_strength"`
	DetectedLanguages       []string      `json:"detected_languages,omitempty"`
	PrimaryDetectedLanguage string        `json:"primary_detected_language,omitempty"`
	CriticalityTags         []string      `json:"criticality_tags,omitempty"`
	IssueReferences         []string      `json:"issue_references,omitempty"`
	ReviewCycles            int           `json:"review_cycles,omitempty"`
	Signals                 []string      `json:"signals,omitempty"`
	Skills                  []string      `json:"skills,omitempty"`
	Flags                   []string      `json:"flags,omitempty"`
	FileBreakdown           FileBreakdown `json:"file_breakdown"`
	PromptSuggested         bool          `json:"prompt_suggested,omitempty"`
}

type FileBreakdown struct {
	Docs   int `json:"docs"`
	Tests  int `json:"tests"`
	Source int `json:"source"`
	Infra  int `json:"infra"`
	Config int `json:"config"`
}

func (req PullRequestAnalysisRequest) Validate() error {
	if strings.TrimSpace(req.Repository.FullName) == "" {
		return errors.New("repository.full_name is required")
	}
	if err := validatePullRequestContext(req.PullRequest); err != nil {
		return err
	}
	return nil
}

func (resp PullRequestAnalysisResponse) Validate() error {
	return resp.validate(true)
}

func (resp PullRequestAnalysisResponse) ValidateForScoring() error {
	return resp.validate(false)
}

func (resp PullRequestAnalysisResponse) Canonicalized() PullRequestAnalysisResponse {
	canonical := resp
	if strings.TrimSpace(canonical.SchemaVersion) == "" {
		canonical.SchemaVersion = PullRequestAnalysisSchemaVersion
	}
	if strings.TrimSpace(canonical.AnalysisSource) == "" {
		canonical.AnalysisSource = AnalysisSourceDeterministic
	}
	return canonical
}

func validatePullRequestContext(pr PullRequestContext) error {
	if strings.TrimSpace(pr.Title) == "" && len(pr.Files) == 0 {
		return errors.New("pull_request.title or pull_request.files is required")
	}
	if pr.Number < 0 {
		return errors.New("pull_request.number must be non-negative")
	}
	if pr.Additions < 0 || pr.Deletions < 0 || pr.ChangedFiles < 0 || pr.Commits < 0 {
		return errors.New("pull_request numeric fields must be non-negative")
	}
	for _, file := range pr.Files {
		if strings.TrimSpace(file.Path) == "" {
			return errors.New("pull_request.files[].path is required")
		}
		if file.Additions < 0 || file.Deletions < 0 {
			return errors.New("pull_request.files[] additions and deletions must be non-negative")
		}
	}
	for _, review := range pr.Reviews {
		if strings.TrimSpace(review.State) == "" {
			return errors.New("pull_request.reviews[].state is required")
		}
	}
	return nil
}

func (resp PullRequestAnalysisResponse) validate(requireFullEnvelope bool) error {
	canonical := resp.Canonicalized()
	if requireFullEnvelope && strings.TrimSpace(canonical.AnalyzerVersion) == "" {
		return errors.New("analyzer_version is required")
	}
	if !isSupportedAnalysisSource(canonical.AnalysisSource) {
		return fmt.Errorf("unsupported analysis_source %q", canonical.AnalysisSource)
	}
	if requireFullEnvelope && strings.TrimSpace(canonical.ValidationStatus) == "" {
		return errors.New("validation_status is required")
	}
	if canonical.ValidationStatus != "" && canonical.ValidationStatus != AnalysisValidationValidated {
		return fmt.Errorf("unsupported validation_status %q", canonical.ValidationStatus)
	}
	if canonical.AnalysisSource == AnalysisSourceAIAssisted || canonical.AnalysisSource == AnalysisSourceHybrid {
		if strings.TrimSpace(canonical.PromptVersion) == "" {
			return errors.New("prompt_version is required for AI-assisted analysis")
		}
		if strings.TrimSpace(canonical.ModelName) == "" {
			return errors.New("model_name is required for AI-assisted analysis")
		}
	}
	if !isSupportedContributionCategory(canonical.Category) {
		return fmt.Errorf("unsupported category %q", canonical.Category)
	}
	if requireFullEnvelope && strings.TrimSpace(canonical.Summary) == "" {
		return errors.New("summary is required")
	}
	if len(canonical.Summary) > 320 {
		return errors.New("summary exceeds 320 characters")
	}
	if err := validateNoScoreOverrideText(canonical.Summary, "summary"); err != nil {
		return err
	}
	if err := validateNoScoreOverrideText(canonical.FallbackReason, "fallback_reason"); err != nil {
		return err
	}
	if canonical.Confidence != 0 && (canonical.Confidence < 0 || canonical.Confidence > 1) {
		return errors.New("confidence must be between 0 and 1")
	}
	if canonical.TechnicalDepth <= 0 || canonical.TechnicalDepth > 3 {
		return errors.New("technical_depth must be between 0 and 3")
	}
	if canonical.ReviewStrength <= 0 || canonical.ReviewStrength > 3 {
		return errors.New("review_strength must be between 0 and 3")
	}
	if err := validateAnalysisStrings(canonical.Signals, "signals"); err != nil {
		return err
	}
	if err := validateAnalysisStrings(canonical.Skills, "skills"); err != nil {
		return err
	}
	if err := validateAnalysisStrings(canonical.Flags, "flags"); err != nil {
		return err
	}
	if err := validateAnalysisStrings(canonical.DetectedLanguages, "detected_languages"); err != nil {
		return err
	}
	if err := validateAnalysisStrings(canonical.CriticalityTags, "criticality_tags"); err != nil {
		return err
	}
	if err := validateAnalysisStrings(canonical.IssueReferences, "issue_references"); err != nil {
		return err
	}
	if canonical.PrimaryDetectedLanguage != "" {
		if err := validateAnalysisStrings([]string{canonical.PrimaryDetectedLanguage}, "primary_detected_language"); err != nil {
			return err
		}
	}
	if canonical.ReviewCycles < 0 {
		return errors.New("review_cycles must be non-negative")
	}
	if canonical.FileBreakdown.Docs < 0 || canonical.FileBreakdown.Tests < 0 || canonical.FileBreakdown.Source < 0 || canonical.FileBreakdown.Infra < 0 || canonical.FileBreakdown.Config < 0 {
		return errors.New("file_breakdown values must be non-negative")
	}
	return nil
}

func validateAnalysisStrings(values []string, field string) error {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return fmt.Errorf("%s entries must be non-empty", field)
		}
		if err := validateNoScoreOverrideText(trimmed, field); err != nil {
			return err
		}
	}
	return nil
}

func validateNoScoreOverrideText(value, field string) error {
	lower := strings.ToLower(strings.TrimSpace(value))
	if lower == "" {
		return nil
	}
	for _, marker := range []string{"final_score", "score_override", "xp_override", "total_xp"} {
		if strings.Contains(lower, marker) {
			return fmt.Errorf("%s may not contain score override instructions", field)
		}
	}
	return nil
}

func isSupportedContributionCategory(category string) bool {
	return slices.Contains([]string{
		"documentation",
		"tests",
		"bug_fix",
		"feature",
		"refactor",
		"performance",
		"infrastructure",
		"security",
		"maintainer_design",
	}, category)
}

func isSupportedAnalysisSource(source string) bool {
	return slices.Contains([]string{
		AnalysisSourceDeterministic,
		AnalysisSourceAIAssisted,
		AnalysisSourceHybrid,
	}, source)
}
