package githubapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/tracekit"
)

type UserAccessTokenRequest struct {
	ClientID     string
	ClientSecret string
	Code         string
	RedirectURL  string
	RefreshToken string
	GrantType    string
}

type UserAccessToken struct {
	AccessToken           string        `json:"access_token"`
	TokenType             string        `json:"token_type"`
	Scope                 string        `json:"scope"`
	ExpiresIn             time.Duration `json:"expires_in"`
	RefreshToken          string        `json:"refresh_token,omitempty"`
	RefreshTokenExpiresIn time.Duration `json:"refresh_token_expires_in"`
}

func ExchangeUserAccessToken(
	ctx context.Context,
	httpClient *http.Client,
	tokenURL string,
	req UserAccessTokenRequest,
) (UserAccessToken, error) {
	if strings.TrimSpace(req.ClientID) == "" {
		return UserAccessToken{}, errors.New("client ID is required")
	}
	if strings.TrimSpace(req.ClientSecret) == "" {
		return UserAccessToken{}, errors.New("client secret is required")
	}
	if strings.TrimSpace(req.Code) == "" {
		return UserAccessToken{}, errors.New("authorization code is required")
	}

	form := url.Values{}
	form.Set("client_id", req.ClientID)
	form.Set("client_secret", req.ClientSecret)
	form.Set("code", req.Code)
	if strings.TrimSpace(req.RedirectURL) != "" {
		form.Set("redirect_uri", req.RedirectURL)
	}

	return doTokenRequest(ctx, httpClient, tokenURL, form)
}

func RefreshUserAccessToken(
	ctx context.Context,
	httpClient *http.Client,
	tokenURL string,
	clientID string,
	clientSecret string,
	refreshToken string,
) (UserAccessToken, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return UserAccessToken{}, errors.New("refresh token is required")
	}

	form := url.Values{}
	form.Set("client_id", strings.TrimSpace(clientID))
	form.Set("client_secret", strings.TrimSpace(clientSecret))
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", strings.TrimSpace(refreshToken))

	return doTokenRequest(ctx, httpClient, tokenURL, form)
}

func doTokenRequest(
	ctx context.Context,
	httpClient *http.Client,
	tokenURL string,
	form url.Values,
) (UserAccessToken, error) {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	if strings.TrimSpace(tokenURL) == "" {
		return UserAccessToken{}, errors.New("token URL is required")
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		tokenURL,
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return UserAccessToken{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Accept", "application/json")
	tracekit.Inject(ctx, request.Header.Set)

	response, err := httpClient.Do(request)
	if err != nil {
		return UserAccessToken{}, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return UserAccessToken{}, fmt.Errorf("GitHub token exchange failed with status %d", response.StatusCode)
	}

	var payload struct {
		AccessToken           string `json:"access_token"`
		TokenType             string `json:"token_type"`
		Scope                 string `json:"scope"`
		ExpiresIn             int64  `json:"expires_in"`
		RefreshToken          string `json:"refresh_token"`
		RefreshTokenExpiresIn int64  `json:"refresh_token_expires_in"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return UserAccessToken{}, err
	}

	return UserAccessToken{
		AccessToken:           payload.AccessToken,
		TokenType:             payload.TokenType,
		Scope:                 payload.Scope,
		ExpiresIn:             time.Duration(payload.ExpiresIn) * time.Second,
		RefreshToken:          payload.RefreshToken,
		RefreshTokenExpiresIn: time.Duration(payload.RefreshTokenExpiresIn) * time.Second,
	}, nil
}

func BuildAppInstallURL(installURL, appSlug string) (string, error) {
	if strings.TrimSpace(installURL) != "" {
		if _, err := url.ParseRequestURI(strings.TrimSpace(installURL)); err != nil {
			return "", err
		}
		return strings.TrimSpace(installURL), nil
	}
	if strings.TrimSpace(appSlug) == "" {
		return "", errors.New("GitHub App install URL or slug is required")
	}
	return "https://github.com/apps/" + strings.TrimSpace(appSlug) + "/installations/new", nil
}

func TokenExpiryRFC3339(now time.Time, ttl time.Duration) string {
	if ttl <= 0 {
		return ""
	}
	return now.UTC().Add(ttl).Format(time.RFC3339)
}

func ParseRetryAfter(header string, now time.Time) time.Duration {
	if strings.TrimSpace(header) == "" {
		return 0
	}
	if seconds, err := strconv.Atoi(strings.TrimSpace(header)); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second
	}
	if at, err := http.ParseTime(header); err == nil {
		wait := at.Sub(now.UTC())
		if wait > 0 {
			return wait
		}
	}
	return 0
}
