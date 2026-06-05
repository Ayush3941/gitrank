"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCcw } from "lucide-react";
import { ExactTime } from "@/components/shared/ExactTime";
import { GlowCard } from "@/components/shared/GlowCard";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { OnboardingStepper } from "@/features/onboarding/components/OnboardingStepper";
import { useRequestProfileSync } from "@/hooks/use-account-actions";
import { useMyProfile } from "@/hooks/use-profile";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { formatRelativeDays, toRatioPercent } from "@/lib/formatters";
import { deriveEffectiveSyncState } from "@/lib/presentation/sync-evidence";
import { formatSyncStateLabel } from "@/lib/presentation/status-tone";
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
  const userSync = useRequestProfileSync();
  const [syncStartedAt, setSyncStartedAt] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState("");
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(POLL_INTERVAL_STEPS_MS[0]);
  const autoRequestedRef = useRef(false);
  const syncStartedEventSent = useRef(false);
  const previousSyncStateRef = useRef<string>("stale");
  const syncPollingAttemptRef = useRef(0);
  const isSyncedRef = useRef(false);
  const syncState = data?.user ? deriveEffectiveSyncState(data.user) : "stale";
  const isSynced = syncState === "synced";

  useEffect(() => {
    isSyncedRef.current = isSynced;
  }, [isSynced]);

  useEffect(() => {
    if (isLoading || isError || !data || autoRequestedRef.current) {
      return;
    }
    autoRequestedRef.current = true;
    if (syncState === "synced") {
      return;
    }
    if (syncState === "syncing") {
      return;
    }
    userSync.mutate(undefined, {
      onSuccess: (result) => {
        syncPollingAttemptRef.current = 0;
        setPollIntervalMs(POLL_INTERVAL_STEPS_MS[0]);
        setSyncStartedAt(result.started_at);
        if (result.status === "queued") {
          setSyncNotice(
            "Initial sync was queued because GitHub fetch is saturated. GitRank will keep polling.",
          );
        }
      },
    });
  }, [data, isError, isLoading, syncState, userSync]);

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

  useEffect(() => {
    if (!syncNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSyncNotice("");
    }, 5200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [syncNotice]);

  const completedSteps =
    isSynced ? steps.length : syncStartedAt || userSync.isPending ? 3 : 1;
  const pipelineProgress = toRatioPercent(completedSteps / steps.length);
  const currentPhaseLabel =
    completedSteps < steps.length ? steps[completedSteps] : "Pipeline complete";

  const actionError = sanitizeUserFacingError(
    (userSync.error as Error | null)?.message ||
      (isError ? "Authenticated profile snapshot is loading. Retry in a moment." : ""),
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
    userSync.mutate(undefined, {
      onSuccess: (result) => {
        syncPollingAttemptRef.current = 0;
        setPollIntervalMs(POLL_INTERVAL_STEPS_MS[0]);
        setSyncStartedAt(result.started_at);
        if (result.status === "queued") {
          setSyncNotice(
            "Retry was queued because GitHub fetch is saturated. GitRank will keep polling.",
          );
        }
      },
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <GlowCard strong className="space-y-8">
        <OnboardingStepper currentStep="analyze" />
        <div className="space-y-3">
          <p className="text-xs font-semibold text-primary">Analyzing</p>
          <h1 className="text-4xl font-semibold text-white">Reading your GitHub history...</h1>
          <p className="max-w-2xl text-base text-muted">
            GitRank is processing your GitHub data and waiting for a refreshed profile snapshot.
          </p>
          {data ? (
            <p className="text-sm text-muted">
              Sync · {formatSyncStateLabel(syncState)} • last refresh{" "}
              {formatRelativeDays(data.refreshedAt)}
            </p>
          ) : null}
          {syncStartedAt ? (
            <p className="text-sm text-cyan-100">
              Sync run started at <ExactTime value={syncStartedAt} />.
            </p>
          ) : null}
          {syncStartedAt && !isSynced ? (
            <p className="text-sm text-muted">
              Auto-refresh slows from 5s up to 20s while sync is pending.
              Current cadence: about {Math.max(5, Math.round(pollIntervalMs / 1000))}s.
            </p>
          ) : null}
          {syncState === "syncing" ? (
            <p className="text-sm text-cyan-100">
              Sync is running. GitRank is waiting for the refreshed snapshot.
            </p>
          ) : null}
          {actionError ? (
            <p role="alert" aria-atomic="true" className="text-sm text-rose-200">
              {actionError}
            </p>
          ) : null}
          <InlineNotice
            message={syncNotice}
            placeholder="Sync status update"
            variant="success"
            minHeightClassName="min-h-7"
            onDismiss={() => {
              setSyncNotice("");
            }}
            dismissLabel="Dismiss sync status update"
          />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-primary">
            <span>Pipeline progress</span>
            <span className="numeric-readout">{pipelineProgress}%</span>
          </div>
          <Progress value={pipelineProgress} aria-label="GitHub sync pipeline progress" />
          <p className="text-sm text-muted">
            {completedSteps} of {steps.length} sync phases completed.
          </p>
        </div>
        <div id="onboarding-sync-phases" className="space-y-3">
          <div className="neon-surface rounded-[var(--radius-universal)] border-dashed border-primary/24 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5">
                Sync state {formatSyncStateLabel(syncState)}
              </span>
              <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5">
                Current phase {currentPhaseLabel}
              </span>
              <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5">
                Poll cadence ~{Math.max(5, Math.round(pollIntervalMs / 1000))}s
              </span>
            </div>
          </div>
          <ol className="space-y-3">
            {steps.map((step, index) => {
              const done = index < completedSteps;
              const active = index === completedSteps && !isSynced;
              return (
                <li
                  key={`sync-step-${index}-${step}`}
                  className="list-none neon-surface flex items-center gap-4 rounded-[var(--radius-universal)] px-4 py-4"
                >
                  <div className="neon-tile rounded-[var(--radius-universal)] p-2 text-primary">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                    ) : (
                      <LoaderCircle className={active ? "h-5 w-5 text-primary" : "h-5 w-5 text-muted"} aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{step}</p>
                    <p className="text-sm text-muted">
                      {done
                        ? "Completed from live sync evidence."
                        : active
                          ? "In progress."
                          : "Pending previous stage."}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="flex flex-wrap gap-3">
          {canRetrySync ? (
            <Button
              variant="secondary"
              onClick={handleRetrySync}
              disabled={userSync.isPending}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Retry sync
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => void refetch()}
            disabled={isLoading || userSync.isPending}
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh status
          </Button>
          {isSynced ? (
            <>
              <Button asChild>
                <IntentPrefetchLink href="/onboarding/reveal">Continue to reveal</IntentPrefetchLink>
              </Button>
              <Button asChild variant="secondary">
                <IntentPrefetchLink href="/dashboard">Open dashboard</IntentPrefetchLink>
              </Button>
            </>
          ) : null}
        </div>
      </GlowCard>
    </div>
  );
}
