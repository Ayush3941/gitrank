package githubapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type TokenSource interface {
	Token(ctx context.Context) (string, error)
}

type StaticTokenSource string

func (s StaticTokenSource) Token(_ context.Context) (string, error) {
	if strings.TrimSpace(string(s)) == "" {
		return "", errors.New("token is empty")
	}
	return string(s), nil
}

type ConditionalRequest struct {
	ETag         string
	LastModified string
}

type RateLimitStatus struct {
	Limit      int       `json:"limit"`
	Remaining  int       `json:"remaining"`
	Used       int       `json:"used"`
	ResetAt    time.Time `json:"reset_at"`
	Resource   string    `json:"resource,omitempty"`
	RequestID  string    `json:"request_id,omitempty"`
	RetryAfter string    `json:"retry_after,omitempty"`
}

type ResponseMetadata struct {
	StatusCode   int               `json:"status_code"`
	RequestID    string            `json:"request_id,omitempty"`
	ETag         string            `json:"etag,omitempty"`
	LastModified string            `json:"last_modified,omitempty"`
	NotModified  bool              `json:"not_modified"`
	RateLimit    RateLimitStatus   `json:"rate_limit"`
	Links        map[string]string `json:"links,omitempty"`
}

type ClientConfig struct {
	BaseURL                        string
	APIVersion                     string
	UserAgent                      string
	TokenSource                    TokenSource
	HTTPClient                     *http.Client
	SecondaryBackoff               time.Duration
	MaxConcurrency                 int
	CircuitBreakerFailureThreshold int
	CircuitBreakerOpenInterval     time.Duration
	CircuitBreakerHalfOpenMax      int
}

type RESTClient struct {
	baseURL          *url.URL
	apiVersion       string
	userAgent        string
	tokenSource      TokenSource
	httpClient       *http.Client
	secondaryBackoff time.Duration
	sem              chan struct{}
	circuit          *circuitBreaker
}

func NewRESTClient(cfg ClientConfig) (*RESTClient, error) {
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return nil, errors.New("base URL is required")
	}
	parsed, err := url.Parse(cfg.BaseURL)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.APIVersion) == "" {
		return nil, errors.New("API version is required")
	}
	if strings.TrimSpace(cfg.UserAgent) == "" {
		return nil, errors.New("user agent is required")
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = http.DefaultClient
	}
	if cfg.SecondaryBackoff <= 0 {
		cfg.SecondaryBackoff = time.Minute
	}
	if cfg.MaxConcurrency <= 0 {
		cfg.MaxConcurrency = 8
	}

	return &RESTClient{
		baseURL:          parsed,
		apiVersion:       cfg.APIVersion,
		userAgent:        cfg.UserAgent,
		tokenSource:      cfg.TokenSource,
		httpClient:       cfg.HTTPClient,
		secondaryBackoff: cfg.SecondaryBackoff,
		sem:              make(chan struct{}, cfg.MaxConcurrency),
		circuit:          newCircuitBreaker(cfg.CircuitBreakerFailureThreshold, cfg.CircuitBreakerOpenInterval, cfg.CircuitBreakerHalfOpenMax),
	}, nil
}

func (c *RESTClient) GetJSON(
	ctx context.Context,
	path string,
	query url.Values,
	conditional ConditionalRequest,
	out any,
) (ResponseMetadata, error) {
	return c.doJSON(ctx, http.MethodGet, path, query, conditional, nil, out)
}

func (c *RESTClient) DoJSON(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	conditional ConditionalRequest,
	body any,
	out any,
) (ResponseMetadata, error) {
	return c.doJSON(ctx, method, path, query, conditional, body, out)
}

func (c *RESTClient) doJSON(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	conditional ConditionalRequest,
	body any,
	out any,
) (ResponseMetadata, error) {
	responseBody, meta, err := c.do(ctx, method, path, query, conditional, body)
	if err != nil {
		return meta, err
	}
	if meta.NotModified || len(responseBody) == 0 || out == nil {
		return meta, nil
	}
	if err := json.Unmarshal(responseBody, out); err != nil {
		return meta, err
	}
	return meta, nil
}

func (c *RESTClient) do(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	conditional ConditionalRequest,
	body any,
) ([]byte, ResponseMetadata, error) {
	var payload []byte
	var err error
	if body != nil {
		payload, err = json.Marshal(body)
		if err != nil {
			return nil, ResponseMetadata{}, err
		}
	}
	if err := c.circuit.before(time.Now()); err != nil {
		return nil, ResponseMetadata{}, err
	}

	var lastErr error
	var lastMeta ResponseMetadata
	for attempt := 0; attempt < 3; attempt++ {
		responseBody, meta, retry, err := c.once(ctx, method, path, query, conditional, payload)
		if err == nil {
			c.circuit.success()
			return responseBody, meta, nil
		}
		lastErr = err
		lastMeta = meta
		if !retry {
			c.observeCircuitResult(meta)
			return nil, meta, err
		}
		time.Sleep(c.backoffDelay(attempt, meta.RateLimit.RetryAfter))
	}
	c.observeCircuitResult(lastMeta)
	return nil, lastMeta, lastErr
}

func (c *RESTClient) observeCircuitResult(meta ResponseMetadata) {
	if isCircuitFailureStatus(meta.StatusCode) {
		c.circuit.failure(time.Now())
		return
	}
	if meta.StatusCode > 0 {
		c.circuit.success()
	}
}

func (c *RESTClient) once(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	conditional ConditionalRequest,
	payload []byte,
) ([]byte, ResponseMetadata, bool, error) {
	c.sem <- struct{}{}
	defer func() { <-c.sem }()

	target, err := c.baseURL.Parse(strings.TrimLeft(path, "/"))
	if err != nil {
		return nil, ResponseMetadata{}, false, err
	}
	if query != nil {
		target.RawQuery = query.Encode()
	}

	var body io.Reader
	if len(payload) > 0 {
		body = bytes.NewReader(payload)
	}
	request, err := http.NewRequestWithContext(ctx, method, target.String(), body)
	if err != nil {
		return nil, ResponseMetadata{}, false, err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", c.userAgent)
	request.Header.Set("X-GitHub-Api-Version", c.apiVersion)
	if len(payload) > 0 {
		request.Header.Set("Content-Type", "application/json")
	}
	if strings.TrimSpace(conditional.ETag) != "" {
		request.Header.Set("If-None-Match", conditional.ETag)
	}
	if strings.TrimSpace(conditional.LastModified) != "" {
		request.Header.Set("If-Modified-Since", conditional.LastModified)
	}
	if c.tokenSource != nil {
		token, err := c.tokenSource.Token(ctx)
		if err != nil {
			return nil, ResponseMetadata{}, false, err
		}
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return nil, ResponseMetadata{}, false, err
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, ResponseMetadata{}, false, err
	}

	meta := metadataFromResponse(response)
	if response.StatusCode == http.StatusNotModified {
		meta.NotModified = true
		return nil, meta, false, nil
	}

	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return responseBody, meta, false, nil
	}

	retry := isSecondaryRateLimited(response.StatusCode, responseBody)
	return nil, meta, retry, fmt.Errorf("GitHub API %s %s failed with status %d", method, target.String(), response.StatusCode)
}

func (c *RESTClient) backoffDelay(attempt int, retryAfter string) time.Duration {
	if delay := ParseRetryAfter(retryAfter, time.Now()); delay > 0 {
		return delay
	}
	base := c.secondaryBackoff
	if base <= 0 {
		base = time.Minute
	}
	jitter := time.Duration(rand.Int63n(int64(base / 2)))
	return base*time.Duration(1<<attempt) + jitter
}

type GraphQLClient struct {
	endpoint         string
	apiVersion       string
	userAgent        string
	tokenSource      TokenSource
	httpClient       *http.Client
	secondaryBackoff time.Duration
	sem              chan struct{}
	circuit          *circuitBreaker
}

type GraphQLRequest struct {
	Query     string `json:"query"`
	Variables any    `json:"variables,omitempty"`
}

type GraphQLError struct {
	Message string `json:"message"`
	Type    string `json:"type,omitempty"`
}

type GraphQLResponse[T any] struct {
	Data   T              `json:"data"`
	Errors []GraphQLError `json:"errors,omitempty"`
}

func NewGraphQLClient(cfg ClientConfig) (*GraphQLClient, error) {
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return nil, errors.New("GraphQL endpoint is required")
	}
	if strings.TrimSpace(cfg.APIVersion) == "" {
		return nil, errors.New("API version is required")
	}
	if strings.TrimSpace(cfg.UserAgent) == "" {
		return nil, errors.New("user agent is required")
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = http.DefaultClient
	}
	if cfg.SecondaryBackoff <= 0 {
		cfg.SecondaryBackoff = time.Minute
	}
	if cfg.MaxConcurrency <= 0 {
		cfg.MaxConcurrency = 8
	}
	return &GraphQLClient{
		endpoint:         strings.TrimSpace(cfg.BaseURL),
		apiVersion:       cfg.APIVersion,
		userAgent:        cfg.UserAgent,
		tokenSource:      cfg.TokenSource,
		httpClient:       cfg.HTTPClient,
		secondaryBackoff: cfg.SecondaryBackoff,
		sem:              make(chan struct{}, cfg.MaxConcurrency),
		circuit:          newCircuitBreaker(cfg.CircuitBreakerFailureThreshold, cfg.CircuitBreakerOpenInterval, cfg.CircuitBreakerHalfOpenMax),
	}, nil
}

func (c *GraphQLClient) QueryJSON(
	ctx context.Context,
	query string,
	variables any,
	out any,
) (ResponseMetadata, error) {
	if strings.TrimSpace(query) == "" {
		return ResponseMetadata{}, errors.New("GraphQL query is required")
	}

	payload, err := json.Marshal(GraphQLRequest{Query: query, Variables: variables})
	if err != nil {
		return ResponseMetadata{}, err
	}
	if err := c.circuit.before(time.Now()); err != nil {
		return ResponseMetadata{}, err
	}

	var lastErr error
	var lastMeta ResponseMetadata
	for attempt := 0; attempt < 3; attempt++ {
		responseBody, meta, retry, err := c.once(ctx, payload)
		lastMeta = meta
		if err == nil {
			var probe struct {
				Errors []GraphQLError `json:"errors,omitempty"`
			}
			if err := json.Unmarshal(responseBody, &probe); err != nil {
				c.observeCircuitResult(meta)
				return meta, err
			}
			if out != nil {
				if err := json.Unmarshal(responseBody, out); err != nil {
					c.observeCircuitResult(meta)
					return meta, err
				}
			}
			if isGraphQLRateLimit(probe.Errors) {
				lastErr = errors.New("GitHub GraphQL secondary rate limit")
			} else {
				c.circuit.success()
				return meta, nil
			}
		} else {
			lastErr = err
			if !retry {
				c.observeCircuitResult(meta)
				return meta, err
			}
		}
		time.Sleep(c.backoffDelay(attempt, meta.RateLimit.RetryAfter))
	}

	c.observeCircuitResult(lastMeta)
	return lastMeta, lastErr
}

func (c *GraphQLClient) observeCircuitResult(meta ResponseMetadata) {
	if isCircuitFailureStatus(meta.StatusCode) {
		c.circuit.failure(time.Now())
		return
	}
	if meta.StatusCode > 0 {
		c.circuit.success()
	}
}

func isCircuitFailureStatus(statusCode int) bool {
	return statusCode == 0 || statusCode == http.StatusTooManyRequests || statusCode >= http.StatusInternalServerError
}

func (c *GraphQLClient) once(
	ctx context.Context,
	payload []byte,
) ([]byte, ResponseMetadata, bool, error) {
	c.sem <- struct{}{}
	defer func() { <-c.sem }()

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, ResponseMetadata{}, false, err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", c.userAgent)
	request.Header.Set("X-GitHub-Api-Version", c.apiVersion)
	if c.tokenSource != nil {
		token, err := c.tokenSource.Token(ctx)
		if err != nil {
			return nil, ResponseMetadata{}, false, err
		}
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return nil, ResponseMetadata{}, false, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, ResponseMetadata{}, false, err
	}
	meta := metadataFromResponse(response)
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return body, meta, false, nil
	}

	retry := isSecondaryRateLimited(response.StatusCode, body)
	return nil, meta, retry, fmt.Errorf("GitHub GraphQL request failed with status %d", response.StatusCode)
}

func (c *GraphQLClient) backoffDelay(attempt int, retryAfter string) time.Duration {
	if delay := ParseRetryAfter(retryAfter, time.Now()); delay > 0 {
		return delay
	}
	base := c.secondaryBackoff
	if base <= 0 {
		base = time.Minute
	}
	jitter := time.Duration(rand.Int63n(int64(base / 2)))
	return base*time.Duration(1<<attempt) + jitter
}

func metadataFromResponse(response *http.Response) ResponseMetadata {
	retryAfter := response.Header.Get("Retry-After")
	return ResponseMetadata{
		StatusCode:   response.StatusCode,
		RequestID:    response.Header.Get("X-GitHub-Request-Id"),
		ETag:         response.Header.Get("ETag"),
		LastModified: response.Header.Get("Last-Modified"),
		RateLimit: RateLimitStatus{
			Limit:      parseIntHeader(response.Header.Get("X-RateLimit-Limit")),
			Remaining:  parseIntHeader(response.Header.Get("X-RateLimit-Remaining")),
			Used:       parseIntHeader(response.Header.Get("X-RateLimit-Used")),
			ResetAt:    parseUnixHeader(response.Header.Get("X-RateLimit-Reset")),
			Resource:   response.Header.Get("X-RateLimit-Resource"),
			RequestID:  response.Header.Get("X-GitHub-Request-Id"),
			RetryAfter: retryAfter,
		},
		Links: ParseLinkHeader(response.Header.Get("Link")),
	}
}

func parseIntHeader(value string) int {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	var parsed int
	_, _ = fmt.Sscanf(value, "%d", &parsed)
	return parsed
}

func parseUnixHeader(value string) time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}
	}
	var epoch int64
	_, _ = fmt.Sscanf(value, "%d", &epoch)
	if epoch <= 0 {
		return time.Time{}
	}
	return time.Unix(epoch, 0).UTC()
}

func isSecondaryRateLimited(status int, body []byte) bool {
	if status != http.StatusForbidden && status != http.StatusTooManyRequests {
		return false
	}
	message := strings.ToLower(string(body))
	return strings.Contains(message, "secondary rate limit")
}

func isGraphQLRateLimit(errors []GraphQLError) bool {
	for _, err := range errors {
		message := strings.ToLower(err.Message)
		if strings.Contains(message, "secondary rate limit") || strings.Contains(message, "rate limit") {
			return true
		}
	}
	return false
}
