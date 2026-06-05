"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  deleteMyAccount,
  exportMyAccountData,
  logoutCurrentSession,
  runPullRequestSync,
  runUserSync,
  startAccountLink,
  unlinkMyAccount,
} from "@/lib/api/account-api";
import { myProfileQueryKey } from "@/hooks/use-profile";

const derivedProfileQueryKeys = [
  myProfileQueryKey,
  ["dashboard"],
  ["contributions"],
  ["badges"],
  ["quests"],
  ["leaderboard"],
  ["profile", "public"],
] as const;
const syncRunsQueryKeyPrefix = ["sync", "runs"] as const;

function invalidateProfileDerivedQueries(queryClient: QueryClient) {
  for (const queryKey of derivedProfileQueryKeys) {
    void queryClient.invalidateQueries({ queryKey });
  }
  void queryClient.invalidateQueries({ queryKey: syncRunsQueryKeyPrefix });
}

export function useRequestProfileSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => runUserSync(),
    onSuccess: () => {
      invalidateProfileDerivedQueries(queryClient);
    },
  });
}

export function useStartAccountLink() {
  return useMutation({
    mutationFn: (returnTo: string) => startAccountLink(returnTo),
  });
}

export function useRunUserSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (user?: string) => runUserSync(user),
    onSuccess: () => {
      invalidateProfileDerivedQueries(queryClient);
    },
  });
}

export function useRunPullRequestSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      repository,
      number,
      user,
      installationId,
    }: {
      repository: string;
      number: number;
      user?: string;
      installationId?: number;
    }) =>
      runPullRequestSync(repository, number, { user, installationId }),
    onSuccess: () => {
      invalidateProfileDerivedQueries(queryClient);
    },
  });
}

export function useUnlinkMyAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlinkMyAccount,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: myProfileQueryKey });
    },
  });
}

export function useDeleteMyAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: myProfileQueryKey });
    },
  });
}

export function useExportMyAccountData() {
  return useMutation({
    mutationFn: exportMyAccountData,
  });
}

export function useLogoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutCurrentSession,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
