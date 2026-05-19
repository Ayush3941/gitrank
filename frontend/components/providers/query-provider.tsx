"use client";

import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { GlobalFetchIndicator } from "@/components/providers/global-fetch-indicator";

const ReactQueryDevtools = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then(
      (module) => module.ReactQueryDevtools,
    ),
  { ssr: false },
);

export function QueryProvider({ children }: { children: ReactNode }) {
  const showDevtools = process.env.NODE_ENV !== "production";
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
