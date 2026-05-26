package service

import (
	"sync"
	"time"
)

const defaultProfileSnapshotStaleTTL = 15 * time.Minute

var (
	profileSnapshotPolicyMu       sync.RWMutex
	profileSnapshotStaleTTLPolicy = defaultProfileSnapshotStaleTTL
)

func setProfileSnapshotStaleTTL(ttl time.Duration) {
	if ttl <= 0 {
		return
	}
	profileSnapshotPolicyMu.Lock()
	profileSnapshotStaleTTLPolicy = ttl
	profileSnapshotPolicyMu.Unlock()
}

func currentProfileSnapshotStaleTTL() time.Duration {
	profileSnapshotPolicyMu.RLock()
	defer profileSnapshotPolicyMu.RUnlock()
	if profileSnapshotStaleTTLPolicy <= 0 {
		return defaultProfileSnapshotStaleTTL
	}
	return profileSnapshotStaleTTLPolicy
}
