"use client";

import { useQuery } from "@tanstack/react-query";
import { getProfileSchema } from "@/lib/api/profile-schema-api";

export function useProfileSchema() {
  return useQuery({
    queryKey: ["profile", "schema"],
    retry: false,
    queryFn: getProfileSchema,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}
