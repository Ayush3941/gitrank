package contracts

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

var (
	githubLoginPattern  = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`)
	githubRepoPattern   = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}$`)
	githubCommitPattern = regexp.MustCompile(`^[A-Fa-f0-9]{6,64}$`)
)

func NormalizeGitHubLogin(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", errors.New("GitHub login is required")
	}
	if !githubLoginPattern.MatchString(value) {
		return "", errors.New("GitHub login must be 1-39 characters of letters, numbers, or hyphens and cannot start or end with a hyphen")
	}
	return value, nil
}

func NormalizeGitHubRepository(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", errors.New("repository is required")
	}
	if strings.ContainsAny(value, `\?#@`) || strings.Contains(value, "://") {
		return "", errors.New("repository must be in owner/name form")
	}
	parts := strings.Split(value, "/")
	if len(parts) != 2 {
		return "", errors.New("repository must be in owner/name form")
	}
	owner, err := NormalizeGitHubLogin(parts[0])
	if err != nil {
		return "", fmt.Errorf("repository owner: %w", err)
	}
	name := strings.TrimSpace(parts[1])
	if name == "" || name == "." || name == ".." || !githubRepoPattern.MatchString(name) {
		return "", errors.New("repository name must be 1-100 characters of letters, numbers, dots, underscores, or hyphens")
	}
	return owner + "/" + name, nil
}

func NormalizeCommitSHA(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", errors.New("commit sha is required")
	}
	if !githubCommitPattern.MatchString(value) {
		return "", errors.New("commit sha must be a 6-64 character hexadecimal Git object id")
	}
	return strings.ToLower(value), nil
}

func (req *SyncRequest) Normalize() error {
	if req == nil {
		return errors.New("sync request is required")
	}
	req.Mode = strings.ToLower(strings.TrimSpace(req.Mode))
	req.User = strings.TrimSpace(req.User)
	req.Repository = strings.TrimSpace(req.Repository)
	req.SHA = strings.TrimSpace(req.SHA)

	switch req.Mode {
	case "installation":
		if req.InstallationID <= 0 {
			return errors.New("installation_id is required when mode=installation")
		}
	case "user":
		user, err := NormalizeGitHubLogin(req.User)
		if err != nil {
			return fmt.Errorf("user: %w", err)
		}
		req.User = user
	case "repository":
		repository, err := NormalizeGitHubRepository(req.Repository)
		if err != nil {
			return err
		}
		req.Repository = repository
	case "pull_request", "review", "issue":
		repository, err := NormalizeGitHubRepository(req.Repository)
		if err != nil {
			return err
		}
		if req.Number <= 0 {
			return errors.New("repository and number are required for pull_request, review, and issue modes")
		}
		req.Repository = repository
	case "commit":
		repository, err := NormalizeGitHubRepository(req.Repository)
		if err != nil {
			return err
		}
		sha, err := NormalizeCommitSHA(req.SHA)
		if err != nil {
			return err
		}
		req.Repository = repository
		req.SHA = sha
	default:
		return errors.New("unsupported sync mode")
	}
	return nil
}
