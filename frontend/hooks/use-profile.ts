"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getMyProfile,
  getPublicProfile,
  updateMyProfilePrivacy,
  updateMyProfileRepositoryVisibility,
} from "@/lib/api/profile-api";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { syncPollingPolicy } from "@/lib/runtime/sync-polling-policy";
import type { PrivacySettings, RepositoryVisibility } from "@/types/gitrank";

export const myProfileQueryKey = ["profile", "me"] as const;
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
    retry: false,
    queryFn: () => getPublicProfile(username),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useMyProfile() {
  const constrainedNetwork = useNetworkConstraintPreference();

  return useQuery({
    queryKey: myProfileQueryKey,
    retry: false,
    queryFn: getMyProfile,
    staleTime: constrainedNetwork
      ? syncPollingPolicy.profileSyncStaleTimeConstrainedMs
      : syncPollingPolicy.profileSyncStaleTimeMs,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      shouldPollMyProfile(query.state.data)
        ? constrainedNetwork
          ? syncPollingPolicy.profileSyncRefetchIntervalConstrainedMs
          : syncPollingPolicy.profileSyncRefetchIntervalMs
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
