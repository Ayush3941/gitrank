package aiapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Config struct {
	BaseURL         string
	APIKey          string
	Model           string
	RequestTimeout  time.Duration
	ModerationModel string
	EmbeddingModel  string
}

type ResponsesRequest struct {
	Model    string            `json:"model"`
	Input    string            `json:"input"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

type HTTPRequest struct {
	Method  string
	URL     string
	Headers http.Header
	Body    []byte
}

func BuildResponsesRequest(cfg Config, req ResponsesRequest) (HTTPRequest, error) {
	if cfg.BaseURL == "" {
		return HTTPRequest{}, errors.New("AI base URL is required")
	}
	if cfg.APIKey == "" {
		return HTTPRequest{}, errors.New("AI API key is required")
	}
	if cfg.Model == "" && req.Model == "" {
		return HTTPRequest{}, errors.New("AI model is required")
	}
	if strings.TrimSpace(req.Input) == "" {
		return HTTPRequest{}, errors.New("responses input is required")
	}

	baseURL, err := parseBaseURL(cfg.BaseURL)
	if err != nil {
		return HTTPRequest{}, err
	}
	baseURL.Path = strings.TrimRight(baseURL.Path, "/") + "/responses"
	baseURL.RawQuery = ""
	baseURL.Fragment = ""

	if req.Model == "" {
		req.Model = cfg.Model
	}

	body, err := json.Marshal(req)
	if err != nil {
		return HTTPRequest{}, err
	}

	headers := http.Header{}
	headers.Set("Authorization", "Bearer "+cfg.APIKey)
	headers.Set("Content-Type", "application/json")

	return HTTPRequest{
		Method:  http.MethodPost,
		URL:     baseURL.String(),
		Headers: headers,
		Body:    body,
	}, nil
}

func parseBaseURL(raw string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil, err
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("AI base URL must use http or https")
	}
	if parsed.Host == "" {
		return nil, fmt.Errorf("AI base URL must include host")
	}
	if parsed.User != nil {
		return nil, fmt.Errorf("AI base URL must not include userinfo")
	}
	if parsed.RawQuery != "" {
		return nil, fmt.Errorf("AI base URL must not include a query string")
	}
	if parsed.Fragment != "" {
		return nil, fmt.Errorf("AI base URL must not include fragment")
	}
	return parsed, nil
}
