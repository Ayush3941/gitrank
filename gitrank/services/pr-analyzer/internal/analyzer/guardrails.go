package analyzer

import (
	"fmt"
	"slices"
	"strings"

	"github.com/gitrank/gitrank/packages/contracts"
)

var guardedSummaryPhrases = []string{
	"expert",
	"world-class",
	"best-in-class",
	"perfect",
	"guaranteed",
	"proves",
	"proven",
	"mastered",
	"ownership",
	"authoritative",
	"definitive",
	"unambiguous",
	"certainly",
}

func applyHallucinationGuardrails(
	req contracts.PullRequestAnalysisRequest,
	breakdown contracts.FileBreakdown,
	features derivedFeatures,
	resp contracts.PullRequestAnalysisResponse,
) error {
	if err := requireGroundedCategory(req, breakdown, features, resp.Category); err != nil {
		return err
	}
	if err := requireGroundedValues(resp.DetectedLanguages, features.detectedLanguages, "detected_languages"); err != nil {
		return err
	}
	if resp.PrimaryDetectedLanguage != "" && !slices.Contains(features.detectedLanguages, resp.PrimaryDetectedLanguage) {
		return fmt.Errorf("primary_detected_language %q is not grounded in changed files", resp.PrimaryDetectedLanguage)
	}
	if err := requireGroundedValues(resp.CriticalityTags, features.criticalityTags, "criticality_tags"); err != nil {
		return err
	}
	if err := requireGroundedValues(resp.IssueReferences, features.issueReferences, "issue_references"); err != nil {
		return err
	}
	if err := requireGroundedValues(resp.Skills, buildSkills(resp.Category, breakdown), "skills"); err != nil {
		return err
	}
	if err := requireGroundedValues(resp.Flags, buildFlags(req, breakdown, features), "flags"); err != nil {
		return err
	}
	if err := requireTemperedSummary(resp.Summary); err != nil {
		return err
	}
	return nil
}

func requireGroundedValues(values, allowed []string, field string) error {
	if len(values) == 0 {
		return nil
	}
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, value := range allowed {
		allowedSet[strings.TrimSpace(value)] = struct{}{}
	}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := allowedSet[trimmed]; !ok {
			return fmt.Errorf("%s entry %q is not grounded in PR evidence", field, trimmed)
		}
	}
	return nil
}

func requireTemperedSummary(summary string) error {
	lower := strings.ToLower(strings.TrimSpace(summary))
	for _, phrase := range guardedSummaryPhrases {
		if strings.Contains(lower, phrase) {
			return fmt.Errorf("summary contains unsupported certainty phrase %q", phrase)
		}
	}
	return nil
}

func requireGroundedCategory(req contracts.PullRequestAnalysisRequest, breakdown contracts.FileBreakdown, features derivedFeatures, category string) error {
	text := strings.ToLower(req.PullRequest.Title + " " + req.PullRequest.Body + " " + strings.Join(req.PullRequest.Labels, " "))
	hasText := func(tokens ...string) bool {
		for _, token := range tokens {
			if strings.Contains(text, token) {
				return true
			}
		}
		return false
	}

	switch category {
	case "documentation":
		if breakdown.Docs == 0 {
			return fmt.Errorf("category %q is not grounded without documentation changes", category)
		}
	case "tests":
		if breakdown.Tests == 0 {
			return fmt.Errorf("category %q is not grounded without test changes", category)
		}
	case "security":
		if !hasText("security", "cve", "auth", "token", "oauth", "permission", "secret") &&
			!slices.Contains(features.criticalityTags, "auth_identity") {
			return fmt.Errorf("category %q is not grounded in PR text or criticality tags", category)
		}
	case "performance":
		if !hasText("performance", "latency", "optimiz", "throughput", "cache") {
			return fmt.Errorf("category %q is not grounded in PR text", category)
		}
	case "refactor":
		if !hasText("refactor", "cleanup", "rename", "simplify") {
			return fmt.Errorf("category %q is not grounded in PR text", category)
		}
	case "infrastructure":
		if breakdown.Infra == 0 {
			return fmt.Errorf("category %q is not grounded without infrastructure changes", category)
		}
	case "bug_fix":
		if !hasText("bug", "fix", "regression", "rollback", "repair", "correct") {
			return fmt.Errorf("category %q is not grounded in PR text", category)
		}
	case "maintainer_design":
		if !hasText("design", "architecture", "maintainer") {
			return fmt.Errorf("category %q is not grounded in PR text", category)
		}
	}
	return nil
}
