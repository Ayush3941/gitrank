package contracts

import "testing"

func TestNewErrorResponse(t *testing.T) {
	resp := NewErrorResponse("bad_request", "invalid request", "req-123")
	if resp.Error.Code != "bad_request" {
		t.Fatalf("Code = %q, want bad_request", resp.Error.Code)
	}
	if resp.Error.RequestID != "req-123" {
		t.Fatalf("RequestID = %q, want req-123", resp.Error.RequestID)
	}
}
