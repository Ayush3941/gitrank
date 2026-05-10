package contracts

import "testing"

func TestSyncRequestNormalizeAcceptsSafeRepositoryTargets(t *testing.T) {
	req := SyncRequest{
		Mode:       "repository",
		Repository: " octo/repo.name_1 ",
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.Repository != "octo/repo.name_1" {
		t.Fatalf("Repository = %q, want octo/repo.name_1", req.Repository)
	}
}

func TestSyncRequestNormalizeRejectsUnsafeRepositoryTargets(t *testing.T) {
	cases := []string{
		"https://github.com/octo/repo",
		"octo/repo/extra",
		"octo/repo?x=http://169.254.169.254",
		"octo\\repo",
		"-octo/repo",
		"octo/..",
	}
	for _, repository := range cases {
		t.Run(repository, func(t *testing.T) {
			req := SyncRequest{Mode: "repository", Repository: repository}
			if err := req.Normalize(); err == nil {
				t.Fatal("Normalize() error = nil, want rejection")
			}
		})
	}
}

func TestSyncRequestNormalizeValidatesCommitSHA(t *testing.T) {
	req := SyncRequest{
		Mode:       "commit",
		Repository: "octo/repo",
		SHA:        "ABC123",
	}
	if err := req.Normalize(); err != nil {
		t.Fatalf("Normalize() error = %v", err)
	}
	if req.SHA != "abc123" {
		t.Fatalf("SHA = %q, want abc123", req.SHA)
	}

	req = SyncRequest{Mode: "commit", Repository: "octo/repo", SHA: "main"}
	if err := req.Normalize(); err == nil {
		t.Fatal("Normalize() error = nil, want non-hex sha rejection")
	}
}
