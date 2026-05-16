"use client";

import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <GlowCard strong className="space-y-4">
      <p className="text-xs tracking-[0.24em] text-danger uppercase">Dashboard error</p>
      <h1 className="text-3xl font-semibold text-white">Dashboard panel failed to render</h1>
      <p className="max-w-2xl text-sm text-slate-200/84">
        Retry this panel now. If the issue persists, open settings and re-run profile sync.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={reset}>
          Retry panel
        </Button>
        <Button asChild>
          <a href="/dashboard/settings">Open settings</a>
        </Button>
      </div>
      {error.digest ? <p className="text-xs text-slate-400">Error digest: {error.digest}</p> : null}
    </GlowCard>
  );
}
