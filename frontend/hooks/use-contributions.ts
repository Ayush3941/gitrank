"use client";

import { useQuery } from "@tanstack/react-query";
import { getContributions } from "@/lib/api/mock-api";
import type { PreviewMode } from "@/types/gitrank";

type ContributionParams = {
  filter?: string;
  search?: string;
  sort?: "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact";
  preview?: PreviewMode;
};

export function useContributions(params: ContributionParams) {
  return useQuery({
    queryKey: ["contributions", params],
    queryFn: () => getContributions(params),
  });
}
