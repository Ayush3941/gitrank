"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/api/mock-api";
import type { PreviewMode } from "@/types/gitrank";

export function useDashboard(preview?: PreviewMode) {
  return useQuery({
    queryKey: ["dashboard", preview],
    queryFn: () => getDashboardData(preview),
  });
}
