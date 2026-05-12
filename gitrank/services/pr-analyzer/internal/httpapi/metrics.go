package httpapi

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
)

const approximateCharsPerToken = 4

type analysisUsageEstimate struct {
	provider     string
	model        string
	source       string
	inputTokens  uint64
	outputTokens uint64
	costUSD      float64
}

type analysisUsageKey struct {
	provider string
	model    string
	source   string
}

type analysisUsageValue struct {
	inputTokens  uint64
	outputTokens uint64
	costUSD      float64
}

type analysisMetricsSource struct {
	service string

	mu      sync.Mutex
	entries map[string]*analysisMetricValue
	usage   map[analysisUsageKey]*analysisUsageValue
}

type analysisMetricValue struct {
	count         uint64
	durationTotal time.Duration
}

func newAnalysisMetricsSource(service string) *analysisMetricsSource {
	return &analysisMetricsSource{
		service: service,
		entries: make(map[string]*analysisMetricValue),
		usage:   make(map[analysisUsageKey]*analysisUsageValue),
	}
}

func (s *analysisMetricsSource) Observe(category string, duration time.Duration, usage analysisUsageEstimate) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	current, ok := s.entries[category]
	if !ok {
		current = &analysisMetricValue{}
		s.entries[category] = current
	}
	current.count++
	current.durationTotal += duration

	key := analysisUsageKey{
		provider: usage.provider,
		model:    usage.model,
		source:   usage.source,
	}
	currentUsage, ok := s.usage[key]
	if !ok {
		currentUsage = &analysisUsageValue{}
		s.usage[key] = currentUsage
	}
	currentUsage.inputTokens += usage.inputTokens
	currentUsage.outputTokens += usage.outputTokens
	currentUsage.costUSD += usage.costUSD
}

func (s *analysisMetricsSource) WritePrometheus(w io.Writer) {
	if s == nil {
		return
	}

	_, _ = fmt.Fprintf(w, "# HELP gitrank_pr_analysis_requests_total Total analyzed pull requests by inferred category.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_pr_analysis_requests_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_pr_analysis_duration_ms_sum Sum of pull-request analysis duration in milliseconds.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_pr_analysis_duration_ms_sum counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_pr_analysis_estimated_tokens_total Estimated token volume for pull-request analysis inputs and outputs.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_pr_analysis_estimated_tokens_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_pr_analysis_estimated_cost_usd_total Estimated AI provider spend in USD for pull-request analysis. Deterministic analysis records zero provider cost.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_pr_analysis_estimated_cost_usd_total counter\n")

	s.mu.Lock()
	categories := make([]string, 0, len(s.entries))
	for category := range s.entries {
		categories = append(categories, category)
	}
	sort.Strings(categories)
	usageKeys := make([]analysisUsageKey, 0, len(s.usage))
	for key := range s.usage {
		usageKeys = append(usageKeys, key)
	}
	sort.Slice(usageKeys, func(i, j int) bool {
		if usageKeys[i].provider != usageKeys[j].provider {
			return usageKeys[i].provider < usageKeys[j].provider
		}
		if usageKeys[i].model != usageKeys[j].model {
			return usageKeys[i].model < usageKeys[j].model
		}
		return usageKeys[i].source < usageKeys[j].source
	})
	snapshots := make([]struct {
		category string
		value    analysisMetricValue
	}, 0, len(categories))
	for _, category := range categories {
		snapshots = append(snapshots, struct {
			category string
			value    analysisMetricValue
		}{
			category: category,
			value:    *s.entries[category],
		})
	}
	usageSnapshots := make([]struct {
		key   analysisUsageKey
		value analysisUsageValue
	}, 0, len(usageKeys))
	for _, key := range usageKeys {
		usageSnapshots = append(usageSnapshots, struct {
			key   analysisUsageKey
			value analysisUsageValue
		}{
			key:   key,
			value: *s.usage[key],
		})
	}
	service := s.service
	s.mu.Unlock()

	for _, snapshot := range snapshots {
		_, _ = fmt.Fprintf(
			w,
			`gitrank_pr_analysis_requests_total{service=%q,category=%q} %d`+"\n",
			service,
			snapshot.category,
			snapshot.value.count,
		)
		_, _ = fmt.Fprintf(
			w,
			`gitrank_pr_analysis_duration_ms_sum{service=%q,category=%q} %.3f`+"\n",
			service,
			snapshot.category,
			float64(snapshot.value.durationTotal.Microseconds())/1000.0,
		)
	}

	for _, snapshot := range usageSnapshots {
		writeTokenMetric := func(phase string, value uint64) {
			_, _ = fmt.Fprintf(
				w,
				`gitrank_pr_analysis_estimated_tokens_total{service=%q,provider=%q,model=%q,source=%q,phase=%q} %d`+"\n",
				service,
				snapshot.key.provider,
				snapshot.key.model,
				snapshot.key.source,
				phase,
				value,
			)
		}
		writeTokenMetric("input", snapshot.value.inputTokens)
		writeTokenMetric("output", snapshot.value.outputTokens)
		writeTokenMetric("total", snapshot.value.inputTokens+snapshot.value.outputTokens)
		_, _ = fmt.Fprintf(
			w,
			`gitrank_pr_analysis_estimated_cost_usd_total{service=%q,provider=%q,model=%q,source=%q} %.6f`+"\n",
			service,
			snapshot.key.provider,
			snapshot.key.model,
			snapshot.key.source,
			snapshot.value.costUSD,
		)
	}
}

func estimateAnalysisUsage(req contracts.PullRequestAnalysisRequest, resp contracts.PullRequestAnalysisResponse, provider string, configuredModel string) analysisUsageEstimate {
	source := strings.TrimSpace(resp.AnalysisSource)
	if source == "" {
		source = contracts.AnalysisSourceDeterministic
	}

	model := strings.TrimSpace(resp.ModelName)
	if model == "" {
		model = strings.TrimSpace(configuredModel)
	}
	provider = strings.TrimSpace(provider)
	if source == contracts.AnalysisSourceDeterministic {
		provider = "none"
		model = "deterministic"
	}
	if provider == "" {
		provider = "unknown"
	}
	if model == "" {
		model = "unknown"
	}

	return analysisUsageEstimate{
		provider:     provider,
		model:        model,
		source:       source,
		inputTokens:  estimateTokens(analysisInputCharacters(req)),
		outputTokens: estimateTokens(analysisOutputCharacters(resp)),
		costUSD:      0,
	}
}

func analysisInputCharacters(req contracts.PullRequestAnalysisRequest) int {
	total := len(req.Repository.FullName) + len(req.Repository.PrimaryLanguage) + len(req.Repository.DefaultBranch)
	total += len(req.PullRequest.Title) + len(req.PullRequest.Body) + len(req.PullRequest.State)
	for _, label := range req.PullRequest.Labels {
		total += len(label)
	}
	for _, issue := range req.PullRequest.LinkedIssues {
		total += len(issue)
	}
	for _, file := range req.PullRequest.Files {
		total += len(file.Path) + len(file.Status)
	}
	for _, review := range req.PullRequest.Reviews {
		total += len(review.State) + len(review.AuthorAssociation)
	}
	return total
}

func analysisOutputCharacters(resp contracts.PullRequestAnalysisResponse) int {
	total := len(resp.SchemaVersion) + len(resp.AnalyzerVersion) + len(resp.AnalysisSource) + len(resp.Summary)
	total += len(resp.PrimaryDetectedLanguage) + len(resp.FallbackReason) + len(resp.PromptVersion) + len(resp.ModelName)
	for _, value := range resp.DetectedLanguages {
		total += len(value)
	}
	for _, value := range resp.CriticalityTags {
		total += len(value)
	}
	for _, value := range resp.IssueReferences {
		total += len(value)
	}
	for _, value := range resp.Signals {
		total += len(value)
	}
	for _, value := range resp.Skills {
		total += len(value)
	}
	for _, value := range resp.Flags {
		total += len(value)
	}
	return total
}

func estimateTokens(characters int) uint64 {
	if characters <= 0 {
		return 0
	}
	return uint64((characters + approximateCharsPerToken - 1) / approximateCharsPerToken)
}
