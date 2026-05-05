package store

import "time"

type GitHubInstallation struct {
	InstallationID      int64     `json:"installation_id"`
	AccountLogin        string    `json:"account_login"`
	AccountType         string    `json:"account_type"`
	TargetType          string    `json:"target_type"`
	PermissionsJSON     []byte    `json:"permissions_json,omitempty"`
	RepositorySelection string    `json:"repository_selection,omitempty"`
	SuspendedAt         time.Time `json:"suspended_at,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type GitHubInstallationRepository struct {
	InstallationID  int64     `json:"installation_id"`
	RepositoryID    int64     `json:"repository_id"`
	FullName        string    `json:"full_name"`
	PermissionsJSON []byte    `json:"permissions_json,omitempty"`
	TrackedAt       time.Time `json:"tracked_at"`
}

type HTTPConditionalCacheEntry struct {
	CacheKey     string    `json:"cache_key"`
	ETag         string    `json:"etag,omitempty"`
	LastModified string    `json:"last_modified,omitempty"`
	ResponseHash string    `json:"response_hash,omitempty"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type SyncCursor struct {
	ScopeType    string    `json:"scope_type"`
	ScopeID      string    `json:"scope_id"`
	ResourceName string    `json:"resource_name"`
	Cursor       string    `json:"cursor,omitempty"`
	ETag         string    `json:"etag,omitempty"`
	LastModified string    `json:"last_modified,omitempty"`
	SyncedAt     time.Time `json:"synced_at"`
}

type SyncRun struct {
	ID             string        `json:"id"`
	JobID          string        `json:"job_id,omitempty"`
	Type           SyncJobType   `json:"type"`
	Status         SyncJobStatus `json:"status"`
	InstallationID int64         `json:"installation_id,omitempty"`
	Repository     string        `json:"repository,omitempty"`
	StartedAt      time.Time     `json:"started_at"`
	FinishedAt     time.Time     `json:"finished_at,omitempty"`
	LastError      string        `json:"last_error,omitempty"`
}
