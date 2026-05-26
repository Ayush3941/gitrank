"use client";

import { useQuery } from "@tanstack/react-query";
import { getServiceDependencies, getServiceManifest } from "@/lib/api/meta-api";

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

export function useServiceDependencies() {
  return useQuery({
    queryKey: ["meta", "dependencies"],
    retry: false,
    queryFn: getServiceDependencies,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}
