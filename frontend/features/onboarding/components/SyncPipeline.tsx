"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCcw } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { OnboardingStepper } from "@/features/onboarding/components/OnboardingStepper";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useMyProfile } from "@/hooks/use-profile";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { formatRelativeDays } from "@/lib/formatters";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

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

const POLL_INTERVAL_STEPS_MS = [5000, 7000, 10000, 15000, 20000] as const;

function syncPollIntervalMs(attempt: number): number {
  if (attempt <= 0) {
    return POLL_INTERVAL_STEPS_MS[0];
  }
  const index = Math.min(attempt, POLL_INTERVAL_STEPS_MS.length - 1);
  return POLL_INTERVAL_STEPS_MS[index];
}

export function SyncPipeline() {
  const { data, isLoading, isError, refetch } = useMyProfile();
  const userSync = useRunUserSync();
  const [syncStartedAt, setSyncStartedAt] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState("");
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(POLL_INTERVAL_STEPS_MS[0]);
  const autoRequestedRef = useRef(false);
  const syncStartedEventSent = useRef(false);
  const previousSyncStateRef = useRef<string>("stale");
  const syncPollingAttemptRef = useRef(0);
  const isSyncedRef = useRef(false);
  const syncState = data?.user.syncStatus.state ?? "stale";
  const isSynced = syncState === "synced";

  useEffect(() => {
    isSyncedRef.current = isSynced;
  }, [isSynced]);

  useEffect(() => {
    if (isLoading || isError || !data || autoRequestedRef.current) {
      return;
    }
    autoRequestedRef.current = true;
    if (data.user.syncStatus.state === "synced") {
      return;
    }
    if (data.user.syncStatus.state === "syncing") {
      return;
    }
    userSync.mutate(data.user.username, {
      onSuccess: (result) => {
        syncPollingAttemptRef.current = 0;
        setPollIntervalMs(POLL_INTERVAL_STEPS_MS[0]);
        setSyncStartedAt(result.started_at);
        if (result.status === "queued" || result.fetched?.fallback_queued === 1) {
          setSyncNotice(
            "Initial sync execution was queued because live GitHub fetch is saturated. GitRank will keep polling for refreshed profile evidence.",
          );
        }
      },
    });
  }, [data, isError, isLoading, userSync]);

  useEffect(() => {
    if (!syncStartedAt || isSynced) {
      syncPollingAttemptRef.current = 0;
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    syncPollingAttemptRef.current = 0;

    const poll = async () => {
      if (cancelled || isSyncedRef.current) {
        return;
      }
      await refetch();
      if (cancelled || isSyncedRef.current) {
        return;
      }
      syncPollingAttemptRef.current += 1;
      const nextDelay = syncPollIntervalMs(syncPollingAttemptRef.current);
      setPollIntervalMs(nextDelay);
      timer = window.setTimeout(() => {
        void poll();
      }, nextDelay);
    };

    timer = window.setTimeout(() => {
      void poll();
    }, POLL_INTERVAL_STEPS_MS[0]);

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
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
  const pipelineProgress = Math.round((completedSteps / steps.length) * 100);

  const actionError = sanitizeUserFacingError(
    (userSync.error as Error | null)?.message ||
      (isError ? "Authenticated profile snapshot is unavailable." : ""),
    "onboarding-sync",
  );
  const canRetrySync =
    Boolean(data) &&
    !userSync.isPending &&
    syncState !== "syncing" &&
    (syncState === "failed" ||
      syncState === "rate_limited" ||
      syncState === "stale" ||
      syncState === "partially_synced" ||
      syncState === "never_synced");

  function handleRetrySync() {
    if (!data || userSync.isPending) {
      return;
    }
    setSyncNotice("");
    userSync.mutate(data.user.username, {
      onSuccess: (result) => {
        syncPollingAttemptRef.current = 0;
        setPollIntervalMs(POLL_INTERVAL_STEPS_MS[0]);
        setSyncStartedAt(result.started_at);
        if (result.status === "queued" || result.fetched?.fallback_queued === 1) {
          setSyncNotice(
            "Retry was queued because live GitHub fetch is saturated. GitRank will keep polling for refreshed profile evidence.",
          );
        }
      },
    });
  }

  return (
    <main className="mx-auto max-w-4xl">
      <GlowCard strong className="space-y-8">
        <OnboardingStepper currentStep="analyze" />
        <div className="space-y-3">
          <p className="text-xs font-semibold text-primary">Analyzing</p>
          <h1 className="text-4xl font-semibold text-white">Reading your open-source history…</h1>
          <p className="max-w-2xl text-base text-muted">
            GitRank is processing your real GitHub data and waiting for a refreshed profile snapshot.
          </p>
          {data ? (
            <p className="text-sm text-muted">
              Snapshot status: {formatSyncState(data.user.syncStatus.state)} • last refresh{" "}
              {formatRelativeDays(data.refreshedAt)}
            </p>
          ) : null}
          {syncStartedAt ? (
            <p className="text-sm text-cyan-100">
              Sync run started at {new Date(syncStartedAt).toLocaleString()}.
            </p>
          ) : null}
          {syncStartedAt && !isSynced ? (
            <p className="text-sm text-muted">
              Auto-refresh cadence slows from 5s up to 20s while sync remains pending to reduce local load.
              Current cadence: about {Math.max(5, Math.round(pollIntervalMs / 1000))}s.
            </p>
          ) : null}
          {syncState === "syncing" ? (
            <p className="text-sm text-cyan-100">
              Sync is already running. GitRank is waiting for the refreshed profile snapshot.
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
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-primary">
            <span>Pipeline progress</span>
            <span className="numeric-readout">{pipelineProgress}%</span>
          </div>
          <Progress value={pipelineProgress} />
          <p className="text-sm text-muted">
            {completedSteps} of {steps.length} sync phases completed.
          </p>
        </div>
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const done = index < completedSteps;
            const active = index === completedSteps && !isSynced;
            return (
              <li
                key={`sync-step-${index}-${step}`}
                className="list-none neon-surface flex items-center gap-4 rounded-[1.75rem] px-4 py-4"
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
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-3">
          {canRetrySync ? (
            <Button
              variant="secondary"
              onClick={handleRetrySync}
              disabled={userSync.isPending}
            >
              <RefreshCcw className="h-4 w-4" />
              Retry sync
            </Button>
          ) : null}
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

function formatSyncState(state: string): string {
  if (state === "never_synced") return "Never synced";
  if (state === "partially_synced") return "Partially synced";
  if (state === "rate_limited") return "Rate limited";
  if (state === "syncing") return "Syncing";
  if (state === "stale") return "Stale";
  if (state === "failed") return "Failed";
  if (state === "synced") return "Synced";
  return state.replaceAll("_", " ");
}
