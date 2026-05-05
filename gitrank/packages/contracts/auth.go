package contracts

import "time"

type GitHubAppInstallPreview struct {
	InstallURL            string `json:"install_url"`
	AppConfigured         bool   `json:"app_configured"`
	UserTokenClientIDMode string `json:"user_token_client_id_mode"`
}

type GitHubAuthStartResponse struct {
	Provider     string    `json:"provider"`
	ClientMode   string    `json:"client_mode"`
	Intent       string    `json:"intent"`
	AuthorizeURL string    `json:"authorize_url"`
	Scopes       []string  `json:"scopes,omitempty"`
	ReturnTo     string    `json:"return_to,omitempty"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type GitHubLinkedAccount struct {
	GitHubUserID int64      `json:"github_user_id"`
	Login        string     `json:"login"`
	DisplayName  string     `json:"display_name,omitempty"`
	Email        string     `json:"email,omitempty"`
	AvatarURL    string     `json:"avatar_url,omitempty"`
	UserType     string     `json:"user_type,omitempty"`
	AccessMode   string     `json:"access_mode,omitempty"`
	Scope        string     `json:"scope,omitempty"`
	LinkedAt     time.Time  `json:"linked_at"`
	UnlinkedAt   *time.Time `json:"unlinked_at,omitempty"`
	Status       string     `json:"status"`
}

type SessionIdentity struct {
	Subject                   string              `json:"subject"`
	DisplayName               string              `json:"display_name,omitempty"`
	AvatarURL                 string              `json:"avatar_url,omitempty"`
	GitHubLogin               string              `json:"github_login,omitempty"`
	GitHubAuthorizationStatus string              `json:"github_authorization_status"`
	Roles                     []string            `json:"roles,omitempty"`
	SessionExpiresAt          time.Time           `json:"session_expires_at"`
	SessionIdleExpiresAt      time.Time           `json:"session_idle_expires_at"`
	SessionRotatedAt          time.Time           `json:"session_rotated_at"`
	LinkedAccount             GitHubLinkedAccount `json:"linked_account"`
}

type SessionEnvelope struct {
	Session    SessionIdentity `json:"session"`
	CSRFHeader string          `json:"csrf_header"`
	CSRFHint   string          `json:"csrf_hint"`
}

type OAuthCompletionResponse struct {
	Provider    string          `json:"provider"`
	ClientMode  string          `json:"client_mode"`
	Intent      string          `json:"intent"`
	RedirectURL string          `json:"redirect_url,omitempty"`
	Session     SessionIdentity `json:"session"`
}

type LogoutResponse struct {
	Status string `json:"status"`
}

type AccountLinkStartResponse struct {
	Provider     string    `json:"provider"`
	ClientMode   string    `json:"client_mode"`
	Intent       string    `json:"intent"`
	AuthorizeURL string    `json:"authorize_url"`
	ReturnTo     string    `json:"return_to,omitempty"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type AccountUnlinkResponse struct {
	Status        string `json:"status"`
	LoggedOut     bool   `json:"logged_out"`
	ReauthorizeAt string `json:"reauthorize_at,omitempty"`
}
