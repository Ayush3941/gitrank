package githubapi

import (
	"context"
	"net/url"
	"strings"
)

type CurrentUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	NodeID    string `json:"node_id"`
	AvatarURL string `json:"avatar_url"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Type      string `json:"type"`
	SiteAdmin bool   `json:"site_admin"`
}

type UserEmail struct {
	Email      string `json:"email"`
	Primary    bool   `json:"primary"`
	Verified   bool   `json:"verified"`
	Visibility string `json:"visibility"`
}

func GetCurrentUser(ctx context.Context, client *RESTClient) (CurrentUser, ResponseMetadata, error) {
	if client == nil {
		return CurrentUser{}, ResponseMetadata{}, errRequiredClient()
	}
	var user CurrentUser
	meta, err := client.GetJSON(ctx, "/user", url.Values(nil), ConditionalRequest{}, &user)
	return user, meta, err
}

func ListUserEmails(ctx context.Context, client *RESTClient) ([]UserEmail, ResponseMetadata, error) {
	if client == nil {
		return nil, ResponseMetadata{}, errRequiredClient()
	}
	var emails []UserEmail
	meta, err := client.GetJSON(ctx, "/user/emails", url.Values(nil), ConditionalRequest{}, &emails)
	return emails, meta, err
}

func PrimaryVerifiedEmail(emails []UserEmail) string {
	for _, email := range emails {
		if email.Primary && email.Verified && strings.TrimSpace(email.Email) != "" {
			return email.Email
		}
	}
	for _, email := range emails {
		if email.Verified && strings.TrimSpace(email.Email) != "" {
			return email.Email
		}
	}
	return ""
}

func errRequiredClient() error {
	return &requiredClientError{}
}

type requiredClientError struct{}

func (e *requiredClientError) Error() string {
	return "REST client is required"
}
