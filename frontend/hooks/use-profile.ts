"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getMyProfile,
  getPublicProfile,
  updateMyProfilePrivacy,
  updateMyProfileRepositoryVisibility,
} from "@/lib/api/profile-api";
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
  return useQuery({
    queryKey: myProfileQueryKey,
    queryFn: getMyProfile,
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
