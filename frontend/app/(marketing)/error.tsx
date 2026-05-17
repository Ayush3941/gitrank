"use client";

import Link from "next/link";
import { useEffect } from "react";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

type MarketingRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
};

export default function MarketingRouteError({
  error,
  reset,
  unstable_retry,
}: MarketingRouteErrorProps) {
  useEffect(() => {
    void emitAnalyticsEvent({
      eventName: "error_state.viewed",
      source: "frontend",
      target: "marketing:route-error",
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
      <p className="text-xs tracking-[0.24em] text-danger uppercase">Marketing route error</p>
      <h1 className="text-3xl font-semibold text-white">GitRank landing route failed to render</h1>
      <p className="max-w-2xl text-sm text-slate-200/84">
        Retry this route now. If the issue persists, open login directly and continue with GitHub OAuth.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={handleRetry}>
          Retry route
        </Button>
        <Button asChild variant="secondary">
          <Link href="/login">Open login</Link>
        </Button>
        <Button asChild>
          <Link href="/onboarding/connect-github">Start onboarding</Link>
        </Button>
      </div>
      {error.digest ? <p className="text-xs text-slate-400">Error digest: {error.digest}</p> : null}
    </GlowCard>
  );
}
