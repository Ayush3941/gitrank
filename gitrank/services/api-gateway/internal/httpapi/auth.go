package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/Ayush3941/gitrank/packages/authkit"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
)

var (
	errUnauthorized = errors.New("authentication required")
	errForbidden    = errors.New("authentication forbidden")
)

type sessionAuthenticator struct {
	client        *http.Client
	authURL       string
	sessionMe     string
	sessionCookie string
	csrfCookie    string
}

func newSessionAuthenticator(client *http.Client, authBaseURL, sessionCookieName, csrfCookieName string) *sessionAuthenticator {
	return &sessionAuthenticator{
		client:        client,
		authURL:       strings.TrimRight(authBaseURL, "/"),
		sessionMe:     "/v1/session/me",
		sessionCookie: strings.TrimSpace(sessionCookieName),
		csrfCookie:    strings.TrimSpace(csrfCookieName),
	}
}

func (a *sessionAuthenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorized, err := a.authorize(r.Context(), w, r)
		if err != nil {
			requestID := httpkit.RequestIDFromContext(r.Context())
			switch {
			case errors.Is(err, errUnauthorized):
				httpkit.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required", requestID)
			case errors.Is(err, errForbidden):
				httpkit.WriteError(w, http.StatusForbidden, "forbidden", "authentication failed", requestID)
			default:
				httpkit.WriteError(w, http.StatusBadGateway, "auth_dependency_failed", err.Error(), requestID)
			}
			return
		}
		next.ServeHTTP(w, authorized)
	})
}

func (a *sessionAuthenticator) authorize(ctx context.Context, w http.ResponseWriter, r *http.Request) (*http.Request, error) {
	target, err := buildProxyURL(a.authURL, a.sessionMe, "")
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	copyHeaderIfPresent(request.Header, "Cookie", r.Header.Get("Cookie"))
	copyHeaderIfPresent(request.Header, "User-Agent", r.UserAgent())
	copyHeaderIfPresent(request.Header, "X-Request-ID", httpkit.RequestIDFromContext(ctx))

	response, err := a.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	switch response.StatusCode {
	case http.StatusOK:
	case http.StatusUnauthorized:
		return nil, errUnauthorized
	case http.StatusForbidden:
		return nil, errForbidden
	default:
		return nil, errors.New("auth-service session lookup failed")
	}

	var envelope contracts.SessionEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, err
	}
	if err := validateSessionEnvelope(envelope); err != nil {
		return nil, fmt.Errorf("invalid auth-service session contract: %w", err)
	}

	cookieHeader := mergeCookies(r.Header.Get("Cookie"), response.Cookies())
	for _, cookie := range response.Cookies() {
		http.SetCookie(w, cookie)
	}

	principal := authkit.Principal{
		Subject:     envelope.Session.Subject,
		GitHubLogin: envelope.Session.GitHubLogin,
		Roles:       envelope.Session.Roles,
	}
	nextRequest := r.Clone(authkit.ContextWithPrincipal(r.Context(), principal))
	if cookieHeader != "" {
		nextRequest.Header.Set("Cookie", cookieHeader)
	}
	if csrfToken := cookieValue(response.Cookies(), a.csrfCookie); csrfToken != "" && strings.TrimSpace(r.Header.Get("X-CSRF-Token")) != "" {
		nextRequest.Header.Set("X-CSRF-Token", csrfToken)
	}
	return nextRequest, nil
}

func validateSessionEnvelope(envelope contracts.SessionEnvelope) error {
	if strings.TrimSpace(envelope.Session.Subject) == "" {
		return errors.New("missing session.subject")
	}
	return nil
}

func mergeCookies(existing string, updates []*http.Cookie) string {
	if len(updates) == 0 {
		return existing
	}

	values := map[string]string{}
	if existing != "" {
		request := &http.Request{Header: http.Header{"Cookie": []string{existing}}}
		for _, cookie := range request.Cookies() {
			values[cookie.Name] = cookie.Value
		}
	}
	for _, cookie := range updates {
		values[cookie.Name] = cookie.Value
	}

	pairs := make([]string, 0, len(values))
	for name, value := range values {
		pairs = append(pairs, (&http.Cookie{Name: name, Value: value}).String())
	}
	return strings.Join(pairs, "; ")
}

func cookieValue(cookies []*http.Cookie, name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie.Value
		}
	}
	return ""
}

func buildProxyURL(baseURL, path, rawQuery string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil {
		return "", err
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("upstream URL must use http or https")
	}
	if parsed.Host == "" {
		return "", errors.New("upstream URL must include host")
	}
	if parsed.User != nil {
		return "", errors.New("upstream URL must not include userinfo")
	}
	if parsed.RawQuery != "" {
		return "", errors.New("upstream URL must not include query string")
	}
	if parsed.Fragment != "" {
		return "", errors.New("upstream URL must not include fragment")
	}
	path, err = safeProxyPath(path)
	if err != nil {
		return "", err
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + path
	parsed.RawPath = ""
	parsed.RawQuery = rawQuery
	parsed.Fragment = ""
	return parsed.String(), nil
}

func safeProxyPath(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" || !strings.HasPrefix(path, "/") {
		return "", errors.New("upstream path must be absolute")
	}
	if strings.HasPrefix(path, "//") || strings.Contains(path, `\`) || strings.Contains(path, "://") {
		return "", errors.New("upstream path must stay relative to the configured base URL")
	}
	return path, nil
}
