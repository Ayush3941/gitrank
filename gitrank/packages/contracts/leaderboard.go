package contracts

import (
	"fmt"
	"strings"
)

type LeaderboardLane string

const (
	LeaderboardGlobal        LeaderboardLane = "global"
	LeaderboardWeekly        LeaderboardLane = "weekly"
	LeaderboardBackend       LeaderboardLane = "backend"
	LeaderboardTesting       LeaderboardLane = "testing"
	LeaderboardDocumentation LeaderboardLane = "documentation"
	LeaderboardRising        LeaderboardLane = "rising"
)

func NormalizeLeaderboardLane(raw string) (LeaderboardLane, error) {
	lane := LeaderboardLane(strings.ToLower(strings.TrimSpace(raw)))
	if lane == "" {
		lane = LeaderboardGlobal
	}
	switch lane {
	case LeaderboardGlobal, LeaderboardWeekly, LeaderboardBackend, LeaderboardTesting, LeaderboardDocumentation, LeaderboardRising:
		return lane, nil
	default:
		return "", fmt.Errorf("unsupported leaderboard lane %q", raw)
	}
}

func (lane LeaderboardLane) RankingMetric() string {
	switch lane {
	case LeaderboardWeekly:
		return "weekly_xp"
	case LeaderboardBackend, LeaderboardTesting, LeaderboardDocumentation:
		return "skill_xp"
	case LeaderboardRising:
		return "global_rank_movement"
	default:
		return "total_xp"
	}
}
