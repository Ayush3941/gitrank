"use client";

import { useEffect, useRef, useState } from "react";
import {
  type AutoSyncNote,
  DashboardTopBar,
  DashboardTopBarSkeleton,
  DashboardTopBarUnavailable,
} from "@/components/shared/DashboardTopBar";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useAccountGamificationPreference } from "@/hooks/use-gamification-preference";
import { useMyProfile } from "@/hooks/use-profile";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

const AUTO_SYNC_RETRY_INTERVAL_MS = 90_000;
const AUTO_SYNC_STALE_AGE_MS = 6 * 60 * 60 * 1000;
const AUTO_SYNC_MAX_ATTEMPTS_PER_MOUNT = 3;

export function DashboardTopBarContainer() {
  const { data, isError, isLoading } = useMyProfile();
  const { mutate: runUserSync, isPending: isUserSyncPending } = useRunUserSync();
  const autoSyncLastAttempt = useRef(0);
  const autoSyncAttempts = useRef(0);
  const [autoSyncOutcome, setAutoSyncOutcome] = useState<AutoSyncNote | null>(null);
  useAccountGamificationPreference(data);

  useEffect(() => {
    if (isLoading || isError || !data) {
      return;
    }
    const syncState = data.user.syncStatus;
    const now = Date.now();
    const lastSyncedAt = Date.parse(syncState.lastSyncedAt ?? "");
    const syncAgeMs = Number.isNaN(lastSyncedAt) ? Number.POSITIVE_INFINITY : now - lastSyncedAt;
    const staleSnapshot = syncState.state !== "synced" || syncState.partialProfileAvailable;
    const staleByAge = syncAgeMs >= AUTO_SYNC_STALE_AGE_MS;
    const emptyEvidence = data.user.mergedPrCount === 0;
    const shouldAutoSync = staleSnapshot || staleByAge || emptyEvidence;
    if (!shouldAutoSync) {
      return;
    }
    if (syncState.state === "syncing") {
      return;
    }
    if (isUserSyncPending) {
      return;
    }
    if (autoSyncAttempts.current >= AUTO_SYNC_MAX_ATTEMPTS_PER_MOUNT) {
      return;
    }
    if (now - autoSyncLastAttempt.current < AUTO_SYNC_RETRY_INTERVAL_MS) {
      return;
    }
    autoSyncLastAttempt.current = now;
    autoSyncAttempts.current += 1;
    runUserSync(data.user.username, {
      onSuccess: (result) => {
        const queuedFallback =
          result.status === "queued" || result.fetched?.fallback_queued === 1;
        autoSyncLastAttempt.current = Date.now();
        if (queuedFallback) {
          setAutoSyncOutcome({
            tone: "info",
            message:
              "Sync execution was queued because live GitHub sync is slow right now. Dashboard data will refresh as background jobs complete.",
          });
          void emitAnalyticsEvent({
            eventName: "sync.queued",
            source: "frontend",
            target: "dashboard",
            status: "success",
          });
          return;
        }
        autoSyncAttempts.current = 0;
        setAutoSyncOutcome({
          tone: "success",
          message: "Background sync finished and profile evidence is up to date.",
        });
        void emitAnalyticsEvent({
          eventName: "sync.succeeded",
          source: "frontend",
          target: "dashboard",
          status: "success",
        });
      },
      onError: () => {
        const attemptsRemaining = AUTO_SYNC_MAX_ATTEMPTS_PER_MOUNT - autoSyncAttempts.current;
        setAutoSyncOutcome({
          tone: "warning",
          message:
            attemptsRemaining > 0
              ? `Background sync hit a temporary issue. GitRank will retry automatically (${attemptsRemaining} retries left).`
              : "Background sync failed repeatedly for this page. Reconnect in Settings or reload to retry.",
        });
        void emitAnalyticsEvent({
          eventName: "sync.failed",
          source: "frontend",
          target: "dashboard",
          status: "failure",
        });
      },
    });
  }, [data, isError, isLoading, isUserSyncPending, runUserSync]);

  if (isLoading) {
    return <DashboardTopBarSkeleton />;
  }

  if (isError || !data) {
    return <DashboardTopBarUnavailable />;
  }

  const autoSyncNote: AutoSyncNote | null = isUserSyncPending
    ? {
      tone: "info",
      message: "Background sync is running. Keep exploring while GitRank refreshes evidence.",
    }
    : data.user.syncStatus.state === "syncing"
      ? {
        tone: "info",
        message: "Profile sync is already running. Dashboard data will refresh automatically.",
      }
      : autoSyncOutcome;

  return (
    <DashboardTopBar
      user={data.user}
      autoSyncNote={autoSyncNote}
      showQuickActions
    />
  );
}
