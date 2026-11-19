"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getMyProfile,
  getPublicProfile,
} from "@/lib/api/profile-api";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { syncPollingPolicy } from "@/lib/runtime/sync-polling-policy";

export const myProfileQueryKey = ["profile", "me"] as const;

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
