"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getMyProfile,
  getPublicProfile,
  updateMyProfilePrivacy,
  updateMyProfileRepositoryVisibility,
} from "@/lib/api/profile-api";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import type { PrivacySettings, RepositoryVisibility } from "@/types/gitrank";

export const myProfileQueryKey = ["profile", "me"] as const;
const PROFILE_SYNC_REFETCH_INTERVAL_MS = 20_000;
const PROFILE_SYNC_REFETCH_INTERVAL_CONSTRAINED_MS = 75_000;
const PROFILE_SYNC_STALE_TIME_MS = 20_000;
const PROFILE_SYNC_STALE_TIME_CONSTRAINED_MS = 60_000;
const derivedProfileQueryKeys = [
  myProfileQueryKey,
  ["dashboard"],
  ["contributions"],
  ["badges"],
  ["quests"],
  ["leaderboard"],
  ["profile", "public"],
] as const;

function shouldPollMyProfile(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  const candidate = data as {
    user?: {
      mergedPrCount?: number;
      syncStatus?: {
        state?: string;
        partialProfileAvailable?: boolean;
      };
    };
  };
  const syncStatus = candidate.user?.syncStatus;
  const state = syncStatus?.state;
  const partial = syncStatus?.partialProfileAvailable ?? false;
  const mergedPrCount = candidate.user?.mergedPrCount ?? 0;

  if (partial) {
    return true;
  }
  if (mergedPrCount <= 0) {
    return true;
  }

  return (
    state === "never_synced" ||
    state === "syncing" ||
    state === "partially_synced" ||
    state === "stale" ||
    state === "failed" ||
    state === "rate_limited"
  );
}

function invalidateProfileDerivedQueries(queryClient: QueryClient) {
  for (const queryKey of derivedProfileQueryKeys) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

type BackedPrivacySettings = Partial<
  Pick<
    PrivacySettings,
    | "publicProfileEnabled"
    | "showExactPRs"
    | "showAiSummaries"
    | "showLeaderboardParticipation"
    | "reducedGamification"
  >
>;

export function useProfile(username: string) {
  return useQuery({
    queryKey: ["profile", "public", username],
    queryFn: () => getPublicProfile(username),
  });
}

export function useMyProfile() {
  const constrainedNetwork = useNetworkConstraintPreference();

  return useQuery({
    queryKey: myProfileQueryKey,
    queryFn: getMyProfile,
    staleTime: constrainedNetwork
      ? PROFILE_SYNC_STALE_TIME_CONSTRAINED_MS
      : PROFILE_SYNC_STALE_TIME_MS,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      shouldPollMyProfile(query.state.data)
        ? constrainedNetwork
          ? PROFILE_SYNC_REFETCH_INTERVAL_CONSTRAINED_MS
          : PROFILE_SYNC_REFETCH_INTERVAL_MS
        : false,
    refetchIntervalInBackground: false,
  });
}

export function useUpdateProfilePrivacy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BackedPrivacySettings) => updateMyProfilePrivacy(input),
    onSuccess: (data) => {
      queryClient.setQueryData(myProfileQueryKey, data);
      invalidateProfileDerivedQueries(queryClient);
    },
  });
}

export function useUpdateRepositoryVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fullName,
      visibility,
      reason,
    }: {
      fullName: string;
      visibility: RepositoryVisibility["visibility"];
      reason: string;
    }) => updateMyProfileRepositoryVisibility(fullName, visibility, reason),
    onSuccess: (data) => {
      queryClient.setQueryData(myProfileQueryKey, data);
      invalidateProfileDerivedQueries(queryClient);
    },
  });
}
