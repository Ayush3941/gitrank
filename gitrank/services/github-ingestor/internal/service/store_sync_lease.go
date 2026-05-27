package service

import (
	"context"
	"errors"
	"hash/fnv"
	"strings"
	"time"
)

func (s *Store) TryAcquireUserSyncLease(ctx context.Context, githubLogin string) (func(), bool, error) {
	if s == nil || s.pool == nil {
		return nil, false, ErrUnavailable
	}
	login := strings.TrimSpace(strings.ToLower(githubLogin))
	if login == "" {
		return nil, false, errors.New("github login is required")
	}

	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return nil, false, err
	}

	key := advisoryLockKeyForGitHubLogin(login)
	var acquired bool
	if queryErr := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock($1)`, key).Scan(&acquired); queryErr != nil {
		conn.Release()
		return nil, false, queryErr
	}
	if !acquired {
		conn.Release()
		return nil, false, nil
	}

	released := false
	release := func() {
		if released {
			return
		}
		released = true
		unlockCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_, _ = conn.Exec(unlockCtx, `SELECT pg_advisory_unlock($1)`, key)
		conn.Release()
	}

	return release, true, nil
}

func advisoryLockKeyForGitHubLogin(login string) int64 {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(strings.TrimSpace(strings.ToLower(login))))
	return int64(hasher.Sum64())
}
