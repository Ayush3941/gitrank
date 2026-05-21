"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export function GlobalFetchIndicator() {
  const fetchCount = useIsFetching();
  const mutationCount = useIsMutating();
  const hasNetworkActivity = fetchCount + mutationCount > 0;

  return (
    hasNetworkActivity ? (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-primary via-primary-2 to-success shadow-[0_0_10px_rgb(34_226_255_/_0.24)]"
      />
    ) : null
  );
}
