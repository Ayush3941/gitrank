package service

import (
	"sync"

	"github.com/gitrank/gitrank/packages/config"
)

var (
	profileRankTierPolicyMu sync.RWMutex
	profileRankTierPolicy   = config.Scoring{}
)

func setRankTierPolicy(scoring config.Scoring) {
	profileRankTierPolicyMu.Lock()
	profileRankTierPolicy = scoring
	profileRankTierPolicyMu.Unlock()
}

func currentRankTierPolicy() config.Scoring {
	profileRankTierPolicyMu.RLock()
	defer profileRankTierPolicyMu.RUnlock()
	return profileRankTierPolicy
}
