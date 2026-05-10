package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/authkit"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func TestPublicProfileRoutePassesThroughPublicProfileContract(t *testing.T) {
	expected := samplePublicProfileResponse()
	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(expected)
	}))
	defer profile.Close()

	router := NewRouter(testConfig(profile.URL, stubAuthServer().URL, stubIngestorServer().URL), testLogger(), "test")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/users/octocat", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if response.Header().Get("Cache-Control") != "public, max-age=60, stale-while-revalidate=300" {
		t.Fatalf("cache-control = %q", response.Header().Get("Cache-Control"))
	}

	var observed contracts.PublicProfileResponse
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !reflect.DeepEqual(observed, expected) {
		t.Fatalf("public profile mismatch: got %+v want %+v", observed, expected)
	}
}

func TestPrivateProfileRoutePassesThroughPrivateProfileContract(t *testing.T) {
	auth := stubAuthServer()
	defer auth.Close()

	expected := samplePrivateProfileResponse()
	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(expected)
	}))
	defer profile.Close()

	router := NewRouter(testConfig(profile.URL, auth.URL, stubIngestorServer().URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodGet, "/v1/me/profile", nil)
	request.Header.Set("Cookie", "gitrank_session=session-original")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if response.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("cache-control = %q", response.Header().Get("Cache-Control"))
	}

	var observed contracts.PrivateProfileResponse
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !reflect.DeepEqual(observed, expected) {
		t.Fatalf("private profile mismatch: got %+v want %+v", observed, expected)
	}
}

func TestLeaderboardRoutePassesThroughLeaderboardContract(t *testing.T) {
	now := time.Date(2026, 5, 5, 15, 4, 0, 0, time.UTC)
	expected := contracts.LeaderboardResponse{
		Entries: []contracts.LeaderboardEntryView{
			{
				Rank:        1,
				Handle:      "octocat",
				DisplayName: "Octo Cat",
				LevelLabel:  "Builder",
				RankTier:    "Silver II",
				TotalXP:     1800,
				WeeklyXP:    250,
				Focus:       "backend",
				RefreshedAt: now,
			},
		},
		Window: contracts.ProfileTimeWindow{
			Label:   "last_6_weeks",
			Bucket:  "week",
			StartAt: now.AddDate(0, 0, -42),
			EndAt:   now,
		},
		GeneratedAt: now,
	}
	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/leaderboard" {
			t.Fatalf("upstream path = %q, want /v1/leaderboard", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(expected)
	}))
	defer profile.Close()

	router := NewRouter(testConfig(profile.URL, stubAuthServer().URL, stubIngestorServer().URL), testLogger(), "test")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/leaderboard", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if response.Header().Get("Cache-Control") != "public, max-age=60, stale-while-revalidate=300" {
		t.Fatalf("cache-control = %q", response.Header().Get("Cache-Control"))
	}

	var observed contracts.LeaderboardResponse
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !reflect.DeepEqual(observed, expected) {
		t.Fatalf("leaderboard mismatch: got %+v want %+v", observed, expected)
	}
}

func TestPrivateProfileRouteRejectsInvalidAuthServiceContract(t *testing.T) {
	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(contracts.SessionEnvelope{})
	}))
	defer auth.Close()

	router := NewRouter(testConfig(stubProfileServer().URL, auth.URL, stubIngestorServer().URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodGet, "/v1/me/profile", nil)
	request.Header.Set("Cookie", "gitrank_session=session-original")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusBadGateway, response.Body.String())
	}

	var observed contracts.ErrorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal error response: %v", err)
	}
	if observed.Error.Code != "auth_dependency_failed" {
		t.Fatalf("error code = %q, want %q", observed.Error.Code, "auth_dependency_failed")
	}
}

func TestSyncRouteRejectsInvalidGitHubIngestorContract(t *testing.T) {
	auth := stubAuthServer()
	defer auth.Close()

	ingestor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"accepted_at":"2026-05-05T15:04:00Z"}`))
	}))
	defer ingestor.Close()

	router := NewRouter(testConfig(stubProfileServer().URL, auth.URL, ingestor.URL), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/sync", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Cookie", "gitrank_session=session-original; gitrank_csrf=csrf-original")
	csrfToken, err := authkit.DoubleSubmitCSRFFromToken([]byte("test-session-secret"), "session-original")
	if err != nil {
		t.Fatalf("csrf token: %v", err)
	}
	request.Header.Set("X-CSRF-Token", csrfToken)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusBadGateway, response.Body.String())
	}

	var observed contracts.ErrorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &observed); err != nil {
		t.Fatalf("unmarshal error response: %v", err)
	}
	if observed.Error.Code != "upstream_transform_failed" {
		t.Fatalf("error code = %q, want %q", observed.Error.Code, "upstream_transform_failed")
	}
}

func samplePublicProfileResponse() contracts.PublicProfileResponse {
	now := time.Date(2026, 5, 5, 15, 4, 0, 0, time.UTC)
	level := contracts.ProfileLevelView{
		Label:        "Builder",
		CurrentLevel: 2,
		CurrentXP:    420,
		NextLevelXP:  600,
		RankTier:     "bronze",
	}
	return contracts.PublicProfileResponse{
		Summary: contracts.PublicProfileSummary{
			Handle:             "octocat",
			DisplayName:        "Octo Cat",
			AvatarURL:          "https://avatars.githubusercontent.com/u/1?v=4",
			Bio:                "Builds reliable platform code.",
			TotalXP:            420,
			StrengthSummary:    "Appears strongest in backend platform contributions.",
			TopSkills:          []string{"backend", "review"},
			BadgesEarned:       2,
			MergedPullRequests: 7,
			UpdatedAt:          now,
		},
		TopSkillAreas: []contracts.SkillAreaView{
			{Key: "backend", TotalXP: 280, Percentage: 66.7, Summary: "Most evidence clusters around backend systems work."},
		},
		TopRepositories: []contracts.TopRepositoryView{
			{
				FullName:           "openai/gitrank",
				Owner:              "openai",
				Name:               "gitrank",
				TotalXP:            240,
				ContributionCount:  5,
				MergedPullRequests: 4,
				PrimarySkill:       "backend",
				LastContributionAt: now,
				Visibility:         "public",
			},
		},
		Level: level,
		Badges: []contracts.BadgeView{
			{Key: "first-pr", Name: "First PR", Description: "Merged first contribution", AwardedAt: now},
		},
		ScoreHistory: []contracts.ScoreHistoryEntry{
			{
				EventID:   "evt_1",
				EventType: "score.computed",
				DeltaXP:   25,
				CreatedAt: now,
				PullRequest: &contracts.PullRequestReference{
					Repository: "openai/gitrank",
					Number:     42,
					Title:      "Tighten profile service projection cache",
				},
				Explanation: []string{"Merged platform work", "Strong review participation"},
			},
		},
		Timeline: contracts.ProfileTimeline{
			Window: contracts.ProfileTimeWindow{
				Label:   "last_6_weeks",
				Bucket:  "week",
				StartAt: now.AddDate(0, 0, -42),
				EndAt:   now,
			},
			Points: []contracts.ProfileTimelinePoint{
				{BucketStart: now.AddDate(0, 0, -7), BucketEnd: now, DeltaXP: 25, TotalXP: 420},
			},
			UpdatedAt: now,
		},
		ShareCard: contracts.ShareableProfileCard{
			Handle:      "octocat",
			DisplayName: "Octo Cat",
			AvatarURL:   "https://avatars.githubusercontent.com/u/1?v=4",
			Headline:    "Backend-focused contributor",
			Level:       level,
			TotalXP:     420,
			TopSkills:   []string{"backend", "review"},
			BadgeKeys:   []string{"first-pr"},
			RefreshedAt: now,
		},
		Staleness: contracts.ProfileStaleness{
			RefreshedAt:             now,
			StaleAfter:              now.Add(6 * time.Hour),
			SourceWatermark:         now,
			IsStale:                 false,
			PartialProfileAvailable: false,
		},
	}
}

func samplePrivateProfileResponse() contracts.PrivateProfileResponse {
	public := samplePublicProfileResponse()
	return contracts.PrivateProfileResponse{
		Summary:         public.Summary,
		TopSkillAreas:   public.TopSkillAreas,
		TopRepositories: public.TopRepositories,
		Level:           public.Level,
		Badges:          public.Badges,
		Timeline:        public.Timeline,
		ScoreHistory:    public.ScoreHistory,
		Privacy: contracts.ProfilePrivacySettings{
			PublicProfileEnabled:         true,
			ShowExactPRs:                 true,
			ShowAISummaries:              false,
			ShowLeaderboardParticipation: true,
		},
		RepositoryVisibility: []contracts.RepositoryVisibilityView{
			{FullName: "openai/gitrank", Visibility: "public", Reason: "core public OSS work"},
		},
		ShareCard: public.ShareCard,
		Staleness: public.Staleness,
	}
}
