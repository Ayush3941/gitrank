"use client";

import Link from "next/link";
import { useEffect } from "react";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { AppShell } from "@/components/shared/AppShell";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void emitAnalyticsEvent({
      eventName: "error_state.viewed",
      source: "frontend",
      target: "global:route-error",
      status: "failure",
    });
  }, []);

  return (
    <html lang="en">
      <body className="min-h-full text-foreground">
        <AppShell className="flex min-h-[70vh] items-center justify-center">
          <GlowCard strong className="w-full max-w-2xl space-y-5 text-center">
            <p className="text-xs font-medium text-danger">Global error</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Something went wrong</h1>
            <p className="mx-auto max-w-xl text-sm text-slate-200/84 sm:text-base">
              GitRank hit an unexpected failure while rendering this route.
              Retry this view or return to a stable dashboard path.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="secondary" onClick={reset}>
                Retry view
              </Button>
              <Button asChild>
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            </div>
            {error.digest ? (
              <p className="text-xs text-slate-400">Error digest: {error.digest}</p>
            ) : null}
          </GlowCard>
        </AppShell>
      </body>
    </html>
  );
}
