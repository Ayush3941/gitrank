package service

import "errors"

var (
	ErrNotFound       = errors.New("profile not found")
	ErrUnauthorized   = errors.New("authentication required")
	ErrInvalidCSRF    = errors.New("invalid CSRF token")
	ErrInvalidRequest = errors.New("invalid request")
	ErrProfileHidden  = errors.New("public profile is disabled")
)
