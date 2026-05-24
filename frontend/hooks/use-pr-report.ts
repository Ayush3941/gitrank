"use client";

import { useQuery } from "@tanstack/react-query";
import { getLivePrReport } from "@/lib/api/pr-report-api";

export function usePrReport(owner: string, repo: string, number: number) {
  return useQuery({
    queryKey: ["pr-report", owner, repo, number],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    queryFn: () => getLivePrReport(owner, repo, number),
  });
}
