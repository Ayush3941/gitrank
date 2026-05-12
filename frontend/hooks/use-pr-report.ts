"use client";

import { useQuery } from "@tanstack/react-query";
import { getLivePrReport } from "@/lib/api/pr-report-api";

export function usePrReport(owner: string, repo: string, number: number) {
  return useQuery({
    queryKey: ["pr-report", owner, repo, number],
    queryFn: () => getLivePrReport(owner, repo, number),
  });
}
