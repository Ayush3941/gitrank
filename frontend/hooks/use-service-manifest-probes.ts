"use client";

import { useQuery } from "@tanstack/react-query";
import { getServiceManifestProbes } from "@/lib/api/service-manifests-api";

export function useServiceManifestProbes() {
  return useQuery({
    queryKey: ["meta", "services"],
    retry: false,
    queryFn: getServiceManifestProbes,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}
