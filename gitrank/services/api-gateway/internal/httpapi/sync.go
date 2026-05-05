package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/authkit"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
)

func handleSyncRequest(w http.ResponseWriter, r *http.Request, client *http.Client, ingestorBaseURL string) {
	var req contracts.SyncRequest
	if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	principal, _ := authkit.PrincipalFromContext(r.Context())
	if err := normalizeSyncRequest(&req, principal); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	targetPath, err := syncRoute(req.Mode)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	headers := defaultForwardHeaders(r)
	headers["Content-Type"] = "application/json"

	body, _ := json.Marshal(req)
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))

	proxyRequest(w, r, client, ingestorBaseURL, targetPath, proxyOptions{
		ForwardHeaders: headers,
		ResponseHeaders: map[string]string{
			"Cache-Control": "private, no-store",
		},
		Transform: func(response *http.Response, payload []byte) (int, []byte, map[string]string, error) {
			if response.StatusCode != http.StatusAccepted {
				return response.StatusCode, payload, nil, nil
			}
			var preview contracts.GitHubQueuePreview
			if err := json.Unmarshal(payload, &preview); err != nil {
				return 0, nil, nil, err
			}
			if err := validateQueuePreview(preview); err != nil {
				return 0, nil, nil, fmt.Errorf("invalid github-ingestor queue preview contract: %w", err)
			}

			out := contracts.SyncResponse{
				Status:        preview.Status,
				CorrelationID: preview.CorrelationID,
				AcceptedAt:    preview.AcceptedAt,
			}
			if len(preview.JobIDs) > 0 {
				out.JobID = preview.JobIDs[0]
			}
			encoded, err := json.Marshal(out)
			if err != nil {
				return 0, nil, nil, err
			}
			return http.StatusAccepted, encoded, map[string]string{
				"Cache-Control": "private, no-store",
			}, nil
		},
	})
}

func normalizeSyncRequest(req *contracts.SyncRequest, principal authkit.Principal) error {
	req.Mode = strings.ToLower(strings.TrimSpace(req.Mode))
	req.User = strings.TrimSpace(req.User)
	req.Repository = strings.TrimSpace(req.Repository)
	req.SHA = strings.TrimSpace(req.SHA)

	if req.Mode == "" {
		req.Mode = "user"
	}
	if req.Mode == "user" && req.User == "" {
		req.User = strings.TrimSpace(principal.GitHubLogin)
	}

	switch req.Mode {
	case "installation":
		if req.InstallationID <= 0 {
			return errors.New("installation_id is required when mode=installation")
		}
	case "user":
		if req.User == "" {
			return errors.New("user is required when mode=user")
		}
	case "repository":
		if req.Repository == "" {
			return errors.New("repository is required when mode=repository")
		}
	case "pull_request", "review", "issue":
		if req.Repository == "" || req.Number <= 0 {
			return errors.New("repository and number are required for pull_request, review, and issue modes")
		}
	case "commit":
		if req.Repository == "" || req.SHA == "" {
			return errors.New("repository and sha are required when mode=commit")
		}
	default:
		return errors.New("unsupported sync mode")
	}
	return nil
}

func validateQueuePreview(preview contracts.GitHubQueuePreview) error {
	if strings.TrimSpace(preview.Status) == "" {
		return errors.New("missing status")
	}
	if preview.AcceptedAt.IsZero() {
		return errors.New("missing accepted_at")
	}
	return nil
}

func syncRoute(mode string) (string, error) {
	switch mode {
	case "installation":
		return "/v1/sync/installation", nil
	case "user":
		return "/v1/sync/user", nil
	case "repository":
		return "/v1/sync/repository", nil
	case "pull_request":
		return "/v1/sync/pull-request", nil
	case "review":
		return "/v1/sync/review", nil
	case "issue":
		return "/v1/sync/issue", nil
	case "commit":
		return "/v1/sync/commit", nil
	default:
		return "", errors.New("unsupported sync mode")
	}
}

func validateSessionCSRF(r *http.Request, sessionCookieName string, sessionSecret []byte) error {
	sessionCookie, err := r.Cookie(strings.TrimSpace(sessionCookieName))
	if err != nil || strings.TrimSpace(sessionCookie.Value) == "" {
		return errors.New("missing session cookie")
	}

	expected, err := authkit.DoubleSubmitCSRFFromToken(sessionSecret, sessionCookie.Value)
	if err != nil {
		return err
	}
	provided := strings.TrimSpace(r.Header.Get("X-CSRF-Token"))
	if provided == "" || provided != expected {
		return errors.New("invalid CSRF token")
	}
	return nil
}

func allowRateLimit(w http.ResponseWriter, r *http.Request, limiter *rateLimiter, scope string) bool {
	retryAfter, allowed := limiter.Allow(scope+":"+clientIP(r), time.Now().UTC())
	if allowed {
		return true
	}
	w.Header().Set("Retry-After", retryAfterSeconds(retryAfter))
	httpkit.WriteError(w, http.StatusTooManyRequests, "rate_limited", "too many requests", httpkit.RequestIDFromContext(r.Context()))
	return false
}
