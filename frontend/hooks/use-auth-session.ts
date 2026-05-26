"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { myProfileQueryKey } from "@/hooks/use-profile";
import { getSessionEnvelope, refreshSession } from "@/lib/api/session-api";

export function useAuthSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    retry: false,
    queryFn: getSessionEnvelope,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useRefreshAuthSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshSession,
    onSuccess: (session) => {
      queryClient.setQueryData(["auth", "session"], session);
      void queryClient.invalidateQueries({ queryKey: myProfileQueryKey });
    },
  });
}
