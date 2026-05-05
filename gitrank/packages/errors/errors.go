package gerrors

import (
	stderrors "errors"
	"fmt"
	"net/http"
)

type Code string

const (
	CodeBadRequest      Code = "bad_request"
	CodeUnauthorized    Code = "unauthorized"
	CodeForbidden       Code = "forbidden"
	CodeNotFound        Code = "not_found"
	CodeConflict        Code = "conflict"
	CodeTooManyRequests Code = "too_many_requests"
	CodeInternal        Code = "internal_error"
)

type Error struct {
	Op        string
	Code      Code
	Message   string
	Status    int
	Retryable bool
	Err       error
}

func (e *Error) Error() string {
	switch {
	case e == nil:
		return "<nil>"
	case e.Op != "" && e.Message != "":
		return fmt.Sprintf("%s: %s", e.Op, e.Message)
	case e.Message != "":
		return e.Message
	case e.Op != "":
		return e.Op
	default:
		return string(e.Code)
	}
}

func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func New(op string, code Code, status int, message string, err error) *Error {
	return &Error{
		Op:      op,
		Code:    code,
		Message: message,
		Status:  status,
		Err:     err,
	}
}

func BadRequest(op, message string, err error) *Error {
	return New(op, CodeBadRequest, http.StatusBadRequest, message, err)
}

func Unauthorized(op, message string, err error) *Error {
	return New(op, CodeUnauthorized, http.StatusUnauthorized, message, err)
}

func Forbidden(op, message string, err error) *Error {
	return New(op, CodeForbidden, http.StatusForbidden, message, err)
}

func NotFound(op, message string, err error) *Error {
	return New(op, CodeNotFound, http.StatusNotFound, message, err)
}

func Conflict(op, message string, err error) *Error {
	return New(op, CodeConflict, http.StatusConflict, message, err)
}

func TooManyRequests(op, message string, err error) *Error {
	return New(op, CodeTooManyRequests, http.StatusTooManyRequests, message, err)
}

func Internal(op, message string, err error) *Error {
	return New(op, CodeInternal, http.StatusInternalServerError, message, err)
}

func HTTPStatus(err error) int {
	var appErr *Error
	if stderrors.As(err, &appErr) && appErr.Status != 0 {
		return appErr.Status
	}
	return http.StatusInternalServerError
}

func CodeOf(err error) Code {
	var appErr *Error
	if stderrors.As(err, &appErr) {
		return appErr.Code
	}
	return CodeInternal
}
