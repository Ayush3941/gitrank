"use client";

import { useQuery } from "@tanstack/react-query";
import { getPrReport } from "@/lib/api/mock-api";
import type { PreviewMode } from "@/types/gitrank";

export function usePrReport(
  owner: string,
  repo: string,
  number: number,
  preview?: PreviewMode,
) {
  return useQuery({
    queryKey: ["pr-report", owner, repo, number, preview],
    queryFn: () => getPrReport(owner, repo, number, preview),
  });
}
