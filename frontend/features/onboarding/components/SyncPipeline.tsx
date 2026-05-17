"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCcw } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";
import { OnboardingStepper } from "@/features/onboarding/components/OnboardingStepper";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useMyProfile } from "@/hooks/use-profile";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
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
  const userSync = useRunUserSync();
  const [syncStartedAt, setSyncStartedAt] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState("");
  const autoRequestedRef = useRef(false);
  const syncStartedEventSent = useRef(false);
  const previousSyncStateRef = useRef<string>("stale");
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
    userSync.mutate(data.user.username, {
      onSuccess: (result) => {
        setSyncStartedAt(result.started_at);
      },
    });
  }, [data, isError, isLoading, userSync]);

  useEffect(() => {
    if (!syncStartedAt || isSynced) {
      return;
    }
    const timer = window.setInterval(() => {
      void refetch();
    }, 5000);
    return () => {
      window.clearInterval(timer);
    };
  }, [isSynced, refetch, syncStartedAt]);

  useEffect(() => {
    if (!syncStartedAt || syncStartedEventSent.current) {
      return;
    }
    syncStartedEventSent.current = true;
    void emitAnalyticsEvent({
      eventName: "onboarding.sync.started",
      source: "frontend",
      target: "onboarding/analyzing",
      status: "success",
    });
  }, [syncStartedAt]);

  useEffect(() => {
    const previousState = previousSyncStateRef.current;
    previousSyncStateRef.current = syncState;
    if (previousState === "synced" || syncState !== "synced") {
      return;
    }
    setSyncNotice("Sync complete. Your profile snapshot is ready for reveal.");
    void emitAnalyticsEvent({
      eventName: "sync.succeeded",
      source: "frontend",
      target: "onboarding/analyzing",
      status: "success",
    });
  }, [syncState]);

  const completedSteps =
    isSynced ? steps.length : syncStartedAt || userSync.isPending ? 3 : 1;

  const actionError =
    (userSync.error as Error | null)?.message ||
    (isError ? "Authenticated profile snapshot is unavailable." : "");

  return (
    <main className="mx-auto max-w-4xl">
      <GlowCard strong className="space-y-8">
        <OnboardingStepper currentStep="analyze" />
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
          {syncStartedAt ? (
            <p className="text-sm text-cyan-100">
              Sync run started at {new Date(syncStartedAt).toLocaleString()}.
            </p>
          ) : null}
          {actionError ? (
            <p role="alert" className="text-sm text-rose-200">
              {actionError}
            </p>
          ) : null}
          {syncNotice ? (
            <p role="status" aria-live="polite" className="text-sm text-emerald-200">
              {syncNotice}
            </p>
          ) : null}
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
            disabled={isLoading || userSync.isPending}
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh status
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
