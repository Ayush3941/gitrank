package analyzer

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gitrank/gitrank/packages/contracts"
)

const (
	defaultAISummaryTimeout = 20 * time.Second
	maxAISummaryRunes       = 320
	maxPromptFilePaths      = 12
)

type geminiSummaryClient struct {
	httpClient *http.Client
	endpoint   string
	apiKey     string
	model      string
}

type chatCompletionRequest struct {
	Model       string                      `json:"model"`
	Temperature float64                     `json:"temperature,omitempty"`
	Messages    []chatCompletionRequestItem `json:"messages"`
}

type chatCompletionRequestItem struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content any `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type aiSummaryError struct {
	reason string
	err    error
}

func (e *aiSummaryError) Error() string {
	if e == nil || e.err == nil {
		return "ai summary error"
	}
	return e.err.Error()
}

func (e *aiSummaryError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

func newGeminiSummaryClient(cfg AIConfig) *geminiSummaryClient {
	if !supportsGeminiProvider(cfg.Provider) {
		return nil
	}

	apiKey := strings.TrimSpace(cfg.APIKey)
	model := strings.TrimSpace(cfg.Model)
	baseURL := strings.TrimSpace(cfg.BaseURL)
	if apiKey == "" || model == "" || baseURL == "" {
		return nil
	}

	parsedBase, err := url.Parse(baseURL)
	if err != nil {
		return nil
	}
	if parsedBase.Scheme != "http" && parsedBase.Scheme != "https" {
		return nil
	}
	if parsedBase.Host == "" {
		return nil
	}

	parsedBase.Path = strings.TrimRight(parsedBase.Path, "/") + "/chat/completions"
	parsedBase.RawQuery = ""
	parsedBase.Fragment = ""

	timeout := cfg.RequestTimeout
	if timeout <= 0 {
		timeout = defaultAISummaryTimeout
	}

	return &geminiSummaryClient{
		httpClient: &http.Client{Timeout: timeout},
		endpoint:   parsedBase.String(),
		apiKey:     apiKey,
		model:      model,
	}
}

func (c *geminiSummaryClient) Summarize(
	ctx context.Context,
	req contracts.PullRequestAnalysisRequest,
	baseline contracts.PullRequestAnalysisResponse,
) (string, error) {
	if c == nil {
		return "", errors.New("gemini summary client is not configured")
	}

	body, err := json.Marshal(chatCompletionRequest{
		Model:       c.model,
		Temperature: 0.2,
		Messages: []chatCompletionRequestItem{
			{
				Role: "system",
				Content: strings.Join([]string{
					"You summarize pull-request evidence for contributor profiling.",
					"Return exactly one neutral sentence with factual phrasing.",
					"Never mention score, XP, rank, certainty claims, or speculation.",
					"Keep output under 220 characters.",
				}, " "),
			},
			{
				Role:    "user",
				Content: buildAISummaryPrompt(req, baseline),
			},
		},
	})
	if err != nil {
		return "", err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+c.apiKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return "", &aiSummaryError{reason: "ai_transport_error", err: err}
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		bodyPreview, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return "", &aiSummaryError{
			reason: classifyAIHTTPFailure(response.StatusCode, string(bodyPreview)),
			err:    fmt.Errorf("gemini chat completion failed with status %d", response.StatusCode),
		}
	}

	var completion chatCompletionResponse
	if err := json.NewDecoder(response.Body).Decode(&completion); err != nil {
		return "", &aiSummaryError{reason: "ai_invalid_response", err: err}
	}
	if len(completion.Choices) == 0 {
		return "", &aiSummaryError{
			reason: "ai_empty_response",
			err:    errors.New("gemini chat completion returned no choices"),
		}
	}

	summary := extractCompletionText(completion.Choices[0].Message.Content)
	summary = normalizeAISummary(summary)
	if summary == "" {
		return "", &aiSummaryError{
			reason: "ai_empty_summary",
			err:    errors.New("gemini chat completion returned empty summary"),
		}
	}
	return summary, nil
}

func supportsGeminiProvider(provider string) bool {
	normalized := strings.ToLower(strings.TrimSpace(provider))
	return normalized == "" || normalized == "gemini"
}

func extractCompletionText(content any) string {
	switch value := content.(type) {
	case string:
		return value
	case []any:
		parts := make([]string, 0, len(value))
		for _, item := range value {
			entry, ok := item.(map[string]any)
			if !ok {
				continue
			}
			text, _ := entry["text"].(string)
			if strings.TrimSpace(text) == "" {
				continue
			}
			parts = append(parts, text)
		}
		return strings.Join(parts, " ")
	default:
		return ""
	}
}

func normalizeAISummary(summary string) string {
	summary = strings.Join(strings.Fields(strings.TrimSpace(summary)), " ")
	if summary == "" {
		return ""
	}
	if utf8.RuneCountInString(summary) > maxAISummaryRunes {
		runes := []rune(summary)
		summary = string(runes[:maxAISummaryRunes])
	}
	return strings.TrimSpace(summary)
}

func classifyAIHTTPFailure(statusCode int, body string) string {
	body = strings.ToLower(body)
	switch statusCode {
	case http.StatusTooManyRequests:
		return "ai_rate_limited"
	case http.StatusUnauthorized, http.StatusForbidden:
		return "ai_auth_failed"
	case http.StatusBadRequest:
		return "ai_invalid_request"
	}
	if strings.Contains(body, "quota") || strings.Contains(body, "resource_exhausted") {
		return "ai_quota_exceeded"
	}
	if statusCode >= http.StatusInternalServerError {
		return "ai_provider_error"
	}
	return "ai_request_failed"
}

func buildAISummaryPrompt(
	req contracts.PullRequestAnalysisRequest,
	baseline contracts.PullRequestAnalysisResponse,
) string {
	filePaths := make([]string, 0, len(req.PullRequest.Files))
	for _, file := range req.PullRequest.Files {
		path := strings.TrimSpace(file.Path)
		if path == "" {
			continue
		}
		filePaths = append(filePaths, path)
		if len(filePaths) >= maxPromptFilePaths {
			break
		}
	}

	return strings.TrimSpace(fmt.Sprintf(
		`Repository: %s
PR: #%d %s
State: %s (merged=%t draft=%t)
Changes: files=%d additions=%d deletions=%d commits=%d
Top paths: %s
Deterministic category: %s
Deterministic signals: %s
Write one concise summary sentence now.`,
		req.Repository.FullName,
		req.PullRequest.Number,
		req.PullRequest.Title,
		req.PullRequest.State,
		req.PullRequest.Merged,
		req.PullRequest.Draft,
		req.PullRequest.ChangedFiles,
		req.PullRequest.Additions,
		req.PullRequest.Deletions,
		req.PullRequest.Commits,
		strings.Join(filePaths, ", "),
		baseline.Category,
		strings.Join(baseline.Signals, ", "),
	))
}
