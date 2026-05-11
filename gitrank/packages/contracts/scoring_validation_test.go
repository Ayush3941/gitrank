package contracts

import (
	"strings"
	"testing"
	"time"
)

func TestVerifyScoreReplayRequestValidate(t *testing.T) {
	now := time.Now().UTC()
	tests := []struct {
		name    string
		req     VerifyScoreReplayRequest
		wantErr string
	}{
		{
			name: "accepts empty filter",
			req:  VerifyScoreReplayRequest{},
		},
		{
			name: "accepts repository and ordered window",
			req: VerifyScoreReplayRequest{
				Repository: "owner/repo",
				From:       now.Add(-time.Hour),
				To:         now,
			},
		},
		{
			name: "rejects reversed window",
			req: VerifyScoreReplayRequest{
				From: now,
				To:   now.Add(-time.Hour),
			},
			wantErr: "from must be before to",
		},
		{
			name: "rejects invalid repository",
			req: VerifyScoreReplayRequest{
				Repository: "https://github.com/owner/repo",
			},
			wantErr: "repository must be in owner/name form",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("Validate() error = %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("Validate() error = %v, want substring %q", err, tt.wantErr)
			}
		})
	}
}
