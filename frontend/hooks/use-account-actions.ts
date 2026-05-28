"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  deleteMyAccount,
  exportMyAccountData,
  logoutCurrentSession,
  queueSyncRequest,
  runCommitSync,
  runInstallationSync,
  runIssueSync,
  runPullRequestSync,
  runRepositorySync,
  runReviewSync,
  runUserSync,
  startAccountLink,
  type QueueSyncInput,
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

export function useQueueSyncRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: QueueSyncInput) => queueSyncRequest(input),
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

export function useRunRepositorySync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repository: string) => runRepositorySync(repository),
    onSuccess: () => {
      invalidateProfileDerivedQueries(queryClient);
    },
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

export function useRunInstallationSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (installationId: number) => runInstallationSync(installationId),
    onSuccess: () => {
      invalidateProfileDerivedQueries(queryClient);
    },
  });
}

export function useRunPullRequestSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ repository, number }: { repository: string; number: number }) =>
      runPullRequestSync(repository, number),
    onSuccess: () => {
      invalidateProfileDerivedQueries(queryClient);
    },
  });
}

export function useRunReviewSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ repository, number }: { repository: string; number: number }) =>
      runReviewSync(repository, number),
    onSuccess: () => {
      invalidateProfileDerivedQueries(queryClient);
    },
  });
}

export function useRunIssueSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ repository, number }: { repository: string; number: number }) =>
      runIssueSync(repository, number),
    onSuccess: () => {
      invalidateProfileDerivedQueries(queryClient);
    },
  });
}

export function useRunCommitSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ repository, sha }: { repository: string; sha: string }) =>
      runCommitSync(repository, sha),
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
