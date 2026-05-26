"use client";

import { useQuery } from "@tanstack/react-query";
import { getServiceManifest } from "@/lib/api/meta-api";

export function useServiceManifest() {
  return useQuery({
    queryKey: ["meta", "manifest"],
    retry: false,
    queryFn: getServiceManifest,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}
