"use client";

import { useQuery } from "@tanstack/react-query";
import { getLivePrReport } from "@/lib/api/pr-report-api";
import type { PreviewMode } from "@/types/gitrank";

export function usePrReport(
  owner: string,
  repo: string,
  number: number,
  preview?: PreviewMode,
) {
  return useQuery({
    queryKey: ["pr-report", owner, repo, number, preview],
    queryFn: async () => {
      if (preview) {
        const { getPrReport } = await import("@/lib/api/mock-api");
        return getPrReport(owner, repo, number, preview);
      }
      return getLivePrReport(owner, repo, number);
    },
  });
}
