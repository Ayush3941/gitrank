package analyzer

import (
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"

	"github.com/Ayush3941/gitrank/packages/contracts"
)

type derivedFeatures struct {
	detectedLanguages       []string
	primaryDetectedLanguage string
	issueReferences         []string
	reviewCycles            int
	criticalityTags         []string
}

var issueReferencePattern = regexp.MustCompile(`(?i)(?:[a-z0-9_.-]+/[a-z0-9_.-]+#\d+|#\d+)`)

func deriveFeatures(req contracts.PullRequestAnalysisRequest, breakdown contracts.FileBreakdown) derivedFeatures {
	detectedLanguages, primaryDetectedLanguage := detectLanguages(req.Repository.PrimaryLanguage, req.PullRequest.Files, breakdown)
	return derivedFeatures{
		detectedLanguages:       detectedLanguages,
		primaryDetectedLanguage: primaryDetectedLanguage,
		issueReferences:         detectIssueReferences(req.PullRequest),
		reviewCycles:            countReviewCycles(req.PullRequest.Reviews),
		criticalityTags:         detectCriticalityTags(req.PullRequest.Files),
	}
}

func detectLanguages(repositoryPrimary string, files []contracts.ChangedFile, breakdown contracts.FileBreakdown) ([]string, string) {
	counts := map[string]int{}
	order := []string{}
	addLanguage := func(language string) {
		if language == "" {
			return
		}
		if _, exists := counts[language]; !exists {
			order = append(order, language)
		}
		counts[language]++
	}

	for _, file := range files {
		if language := languageForFile(file.Path); language != "" {
			addLanguage(language)
		}
	}

	normalizedPrimary := normalizeLanguageName(repositoryPrimary)
	if normalizedPrimary != "" && (breakdown.Source > 0 || len(files) == 0) {
		addLanguage(normalizedPrimary)
	}

	if len(order) == 0 {
		return nil, normalizedPrimary
	}

	primary := normalizedPrimary
	if primary == "" || counts[primary] == 0 {
		primary = order[0]
		for _, candidate := range order[1:] {
			if counts[candidate] > counts[primary] {
				primary = candidate
			}
		}
	}

	sort.SliceStable(order, func(i, j int) bool {
		if counts[order[i]] == counts[order[j]] {
			if order[i] == primary {
				return true
			}
			if order[j] == primary {
				return false
			}
			return order[i] < order[j]
		}
		return counts[order[i]] > counts[order[j]]
	})

	return order, primary
}

func languageForFile(path string) string {
	base := strings.ToLower(filepath.Base(path))
	ext := strings.ToLower(filepath.Ext(base))

	switch base {
	case "dockerfile":
		return "Dockerfile"
	case "makefile":
		return "Makefile"
	}

	switch ext {
	case ".go":
		return "Go"
	case ".ts", ".tsx":
		return "TypeScript"
	case ".js", ".jsx", ".mjs", ".cjs":
		return "JavaScript"
	case ".py":
		return "Python"
	case ".rb":
		return "Ruby"
	case ".rs":
		return "Rust"
	case ".java":
		return "Java"
	case ".kt":
		return "Kotlin"
	case ".swift":
		return "Swift"
	case ".c", ".h":
		return "C"
	case ".cc", ".cpp", ".cxx", ".hpp":
		return "C++"
	case ".cs":
		return "C#"
	case ".php":
		return "PHP"
	case ".sql":
		return "SQL"
	case ".sh", ".bash", ".zsh":
		return "Shell"
	case ".yaml", ".yml":
		return "YAML"
	case ".json":
		return "JSON"
	case ".toml":
		return "TOML"
	case ".tf":
		return "Terraform"
	case ".md", ".rst", ".adoc":
		return "Markdown"
	default:
		return ""
	}
}

func normalizeLanguageName(language string) string {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case "":
		return ""
	case "go", "golang":
		return "Go"
	case "typescript", "ts":
		return "TypeScript"
	case "javascript", "js":
		return "JavaScript"
	case "python", "py":
		return "Python"
	case "ruby", "rb":
		return "Ruby"
	case "rust", "rs":
		return "Rust"
	case "java":
		return "Java"
	case "kotlin", "kt":
		return "Kotlin"
	case "swift":
		return "Swift"
	case "c":
		return "C"
	case "c++", "cpp":
		return "C++"
	case "c#", "csharp":
		return "C#"
	case "php":
		return "PHP"
	case "sql":
		return "SQL"
	case "shell", "bash", "zsh":
		return "Shell"
	case "yaml", "yml":
		return "YAML"
	case "json":
		return "JSON"
	case "toml":
		return "TOML"
	case "terraform", "tf":
		return "Terraform"
	case "markdown", "md":
		return "Markdown"
	case "dockerfile":
		return "Dockerfile"
	case "makefile":
		return "Makefile"
	default:
		return strings.TrimSpace(language)
	}
}

func detectIssueReferences(pr contracts.PullRequestContext) []string {
	references := make([]string, 0, len(pr.LinkedIssues))
	seen := map[string]struct{}{}

	for _, raw := range pr.LinkedIssues {
		addIssueReference(seen, &references, raw)
	}

	for _, match := range issueReferencePattern.FindAllString(pr.Title+" "+pr.Body, -1) {
		addIssueReference(seen, &references, match)
	}

	return references
}

func addIssueReference(seen map[string]struct{}, references *[]string, raw string) {
	reference := strings.TrimSpace(raw)
	if reference == "" {
		return
	}
	if strings.Contains(reference, "/") {
		reference = strings.ToLower(reference)
	}
	if _, exists := seen[reference]; exists {
		return
	}
	seen[reference] = struct{}{}
	*references = append(*references, reference)
}

func countReviewCycles(reviews []contracts.ReviewSignal) int {
	cycles := 0
	for _, review := range reviews {
		if strings.EqualFold(review.State, "changes_requested") {
			cycles++
		}
	}
	return cycles
}

func detectCriticalityTags(files []contracts.ChangedFile) []string {
	var tags []string
	for _, file := range files {
		path := strings.ToLower(file.Path)
		switch {
		case strings.Contains(path, "/auth/") ||
			strings.Contains(path, "oauth") ||
			strings.Contains(path, "session") ||
			strings.Contains(path, "token") ||
			strings.Contains(path, "secret") ||
			strings.Contains(path, "permission"):
			tags = appendTag(tags, "auth_identity")
		case strings.Contains(path, "migration") ||
			strings.Contains(path, "/db/") ||
			strings.Contains(path, "/sql/") ||
			strings.Contains(path, "schema") ||
			strings.Contains(path, "repository") ||
			strings.Contains(path, "store"):
			tags = appendTag(tags, "data_persistence")
		case strings.Contains(path, "/api/") ||
			strings.Contains(path, "openapi") ||
			strings.Contains(path, "router") ||
			strings.Contains(path, "handler") ||
			strings.Contains(path, "http"):
			tags = appendTag(tags, "api_surface")
		case strings.HasPrefix(path, ".github/workflows/") ||
			strings.Contains(path, "docker") ||
			strings.Contains(path, "deploy") ||
			strings.Contains(path, "k8s") ||
			strings.Contains(path, "terraform") ||
			strings.Contains(path, "helm") ||
			strings.Contains(path, "compose"):
			tags = appendTag(tags, "delivery_ops")
		case strings.HasPrefix(path, "cmd/") ||
			strings.Contains(path, "main.go") ||
			strings.Contains(path, "bootstrap") ||
			strings.Contains(path, "startup"):
			tags = appendTag(tags, "runtime_bootstrap")
		}
	}
	return tags
}

func appendTag(tags []string, tag string) []string {
	if slices.Contains(tags, tag) {
		return tags
	}
	return append(tags, tag)
}

func isDocPath(path string) bool {
	base := filepath.Base(path)
	return strings.HasPrefix(path, "docs/") ||
		strings.HasPrefix(path, ".github/") ||
		strings.HasSuffix(base, ".md") ||
		strings.HasSuffix(base, ".rst") ||
		strings.HasSuffix(base, ".adoc")
}

func isTestPath(path string) bool {
	base := filepath.Base(path)
	return strings.Contains(path, "/test/") ||
		strings.Contains(path, "/tests/") ||
		strings.HasSuffix(base, "_test.go") ||
		strings.HasPrefix(base, "test_")
}

func isInfraPath(path string) bool {
	return strings.HasPrefix(path, "deployments/") ||
		strings.HasPrefix(path, ".github/workflows/") ||
		strings.Contains(path, "docker") ||
		strings.Contains(path, "k8s") ||
		strings.HasSuffix(path, ".tf")
}

func isConfigPath(path string) bool {
	base := filepath.Base(path)
	return strings.HasPrefix(path, "config/") ||
		strings.HasPrefix(path, ".env") ||
		strings.HasSuffix(base, ".yaml") ||
		strings.HasSuffix(base, ".yml") ||
		strings.HasSuffix(base, ".json") ||
		strings.HasSuffix(base, ".toml")
}
