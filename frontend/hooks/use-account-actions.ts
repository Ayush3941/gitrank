"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteMyAccount,
  exportMyAccountData,
  logoutCurrentSession,
  requestProfileSync,
  unlinkMyAccount,
} from "@/lib/api/account-api";
import { myProfileQueryKey } from "@/hooks/use-profile";

export function useRequestProfileSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: requestProfileSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myProfileQueryKey });
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
