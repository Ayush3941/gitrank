package gerrors

import (
	"errors"
	"net/http"
	"testing"
)

func TestHTTPStatus(t *testing.T) {
	err := BadRequest("decode", "invalid payload", nil)
	if got := HTTPStatus(err); got != http.StatusBadRequest {
		t.Fatalf("HTTPStatus() = %d, want %d", got, http.StatusBadRequest)
	}
}

func TestCodeOfDefaultsToInternal(t *testing.T) {
	if got := CodeOf(errors.New("boom")); got != CodeInternal {
		t.Fatalf("CodeOf() = %q, want %q", got, CodeInternal)
	}
}
