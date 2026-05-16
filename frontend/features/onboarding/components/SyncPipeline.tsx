"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCcw } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";
import { useRequestProfileSync } from "@/hooks/use-account-actions";
import { useMyProfile } from "@/hooks/use-profile";
import { formatRelativeDays } from "@/lib/formatters";

const steps = [
  "Connecting GitHub",
  "Fetching repositories",
  "Reading merged PRs",
  "Analyzing review depth",
  "Classifying contribution type",
  "Calculating PR intensity",
  "Assigning badges",
  "Building public profile",
];

export function SyncPipeline() {
  const { data, isLoading, isError, refetch } = useMyProfile();
  const requestSync = useRequestProfileSync();
  const [syncQueuedAt, setSyncQueuedAt] = useState<string | null>(null);
  const autoRequestedRef = useRef(false);
  const syncState = data?.user.syncStatus.state ?? "stale";
  const isSynced = syncState === "synced";

  useEffect(() => {
    if (isLoading || isError || !data || autoRequestedRef.current) {
      return;
    }
    autoRequestedRef.current = true;
    if (data.user.syncStatus.state === "synced") {
      return;
    }
    requestSync.mutate(undefined, {
      onSuccess: (result) => {
        setSyncQueuedAt(result.accepted_at);
      },
    });
  }, [data, isError, isLoading, requestSync]);

  useEffect(() => {
    if (!syncQueuedAt || isSynced) {
      return;
    }
    const timer = window.setInterval(() => {
      void refetch();
    }, 5000);
    return () => {
      window.clearInterval(timer);
    };
  }, [isSynced, refetch, syncQueuedAt]);

  const completedSteps =
    isSynced ? steps.length : syncQueuedAt || requestSync.isPending ? 3 : 1;

  const actionError =
    (requestSync.error as Error | null)?.message ||
    (isError ? "Authenticated profile snapshot is unavailable." : "");

  function handleQueueSync() {
    requestSync.mutate(undefined, {
      onSuccess: (result) => {
        setSyncQueuedAt(result.accepted_at);
        void refetch();
      },
    });
  }

  return (
    <main className="mx-auto max-w-4xl">
      <GlowCard strong className="space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">Analyzing</p>
          <h1 className="text-4xl font-semibold text-white">Reading your open-source history…</h1>
          <p className="max-w-2xl text-base text-muted">
            GitRank is processing your real GitHub data and waiting for a refreshed profile snapshot.
          </p>
          {data ? (
            <p className="text-sm text-slate-200/86">
              Snapshot status: {data.user.syncStatus.state.replace("_", " ")} • last refresh{" "}
              {formatRelativeDays(data.refreshedAt)}
            </p>
          ) : null}
          {syncQueuedAt ? (
            <p className="text-sm text-cyan-100">
              Sync queued at {new Date(syncQueuedAt).toLocaleString()}.
            </p>
          ) : null}
          {actionError ? <p className="text-sm text-rose-200">{actionError}</p> : null}
        </div>
        <div className="space-y-3">
          {steps.map((step, index) => {
            const done = index < completedSteps;
            const active = index === completedSteps && !isSynced;
            return (
              <div
                key={step}
                className="neon-surface flex items-center gap-4 rounded-[1.75rem] px-4 py-4"
              >
                <div className="neon-tile rounded-2xl p-2 text-primary">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <LoaderCircle className={active ? "h-5 w-5 text-primary" : "h-5 w-5 text-muted"} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{step}</p>
                  <p className="text-sm text-muted">
                    {done
                      ? "Verified from live sync evidence."
                      : active
                        ? "In progress against live backend data."
                        : "Pending previous stage completion."}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => void refetch()}
            disabled={isLoading || requestSync.isPending}
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh status
          </Button>
          <Button onClick={handleQueueSync} disabled={requestSync.isPending}>
            {requestSync.isPending ? "Queueing sync..." : "Queue sync now"}
          </Button>
          {isSynced ? (
            <>
              <Button asChild>
                <Link href="/onboarding/reveal">Continue to reveal</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            </>
          ) : null}
        </div>
      </GlowCard>
    </main>
  );
}
