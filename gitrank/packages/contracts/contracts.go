package contracts

import "time"

type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id,omitempty"`
}

type HealthResponse struct {
	Status      string                    `json:"status"`
	Service     string                    `json:"service"`
	Environment string                    `json:"environment,omitempty"`
	Version     string                    `json:"version,omitempty"`
	Timestamp   time.Time                 `json:"timestamp"`
	Checks      map[string]ComponentCheck `json:"checks,omitempty"`
}

type ComponentCheck struct {
	Status  string `json:"status"`
	Details string `json:"details,omitempty"`
}

type SyncRequest struct {
	User           string `json:"user,omitempty"`
	Repository     string `json:"repository,omitempty"`
	Mode           string `json:"mode,omitempty"`
	InstallationID int64  `json:"installation_id,omitempty"`
	Number         int    `json:"number,omitempty"`
	SHA            string `json:"sha,omitempty"`
}

type SyncResponse struct {
	Status        string    `json:"status"`
	JobID         string    `json:"job_id,omitempty"`
	CorrelationID string    `json:"correlation_id,omitempty"`
	AcceptedAt    time.Time `json:"accepted_at"`
}

type ProfileSummary struct {
	Handle    string    `json:"handle"`
	Level     string    `json:"level"`
	TotalXP   int       `json:"total_xp"`
	UpdatedAt time.Time `json:"updated_at"`
}

func NewHealthResponse(service, environment, version string, checks map[string]ComponentCheck) HealthResponse {
	return HealthResponse{
		Status:      "ok",
		Service:     service,
		Environment: environment,
		Version:     version,
		Timestamp:   time.Now().UTC(),
		Checks:      checks,
	}
}

func NewErrorResponse(code, message, requestID string) ErrorResponse {
	return ErrorResponse{
		Error: ErrorBody{
			Code:      code,
			Message:   message,
			RequestID: requestID,
		},
	}
}
