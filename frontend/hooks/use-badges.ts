"use client";

import { useQuery } from "@tanstack/react-query";
import { getBadges } from "@/lib/api/mock-api";
import type { PreviewMode } from "@/types/gitrank";

export function useBadges(preview?: PreviewMode) {
  return useQuery({
    queryKey: ["badges", preview],
    queryFn: () => getBadges(preview),
  });
}
