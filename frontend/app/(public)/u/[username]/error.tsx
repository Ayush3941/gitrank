"use client";

import Link from "next/link";
import { useEffect } from "react";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
};

export default function PublicProfileRouteError({
  error,
  reset,
  unstable_retry,
}: RouteErrorProps) {
  useEffect(() => {
    void emitAnalyticsEvent({
      eventName: "error_state.viewed",
      source: "frontend",
      target: "public-profile:route-error",
      status: "failure",
    });
  }, []);

  function handleRetry() {
    if (typeof unstable_retry === "function") {
      unstable_retry();
      return;
    }
    reset();
  }

  return (
    <GlowCard strong className="space-y-4">
      <p className="text-xs tracking-[0.24em] text-danger uppercase">Public profile error</p>
      <h1 className="text-3xl font-semibold text-white">Profile view failed to render</h1>
      <p className="max-w-2xl text-sm text-slate-200/84">
        Retry this profile route now. If it still fails, return to dashboard sync settings
        and refresh the account snapshot.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={handleRetry}>
          Retry profile route
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard/settings">Open settings</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </div>
      {error.digest ? <p className="text-xs text-slate-400">Error digest: {error.digest}</p> : null}
    </GlowCard>
  );
}
