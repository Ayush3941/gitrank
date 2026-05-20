"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import { GlobalFetchIndicator } from "@/components/providers/global-fetch-indicator";

export function QueryProvider({ children }: { children: ReactNode }) {
  const showDevtools = useSyncExternalStore(
    subscribeToNoopExternalStore,
    readLocalDevtoolsFlag,
    () => false,
  );
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalFetchIndicator />
      {children}
      {showDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}

function subscribeToNoopExternalStore() {
  return () => {};
}

function readLocalDevtoolsFlag() {
  if (typeof window === "undefined") {
    return false;
  }
  const hostname = window.location.hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);
  return localHosts.has(hostname) || hostname.endsWith(".local");
}
