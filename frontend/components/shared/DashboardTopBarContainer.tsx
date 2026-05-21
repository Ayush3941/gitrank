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
const AUTO_SYNC_ATTEMPT_RECOVERY_COOLDOWN_MS = 10 * 60 * 1000;
const AUTO_SYNC_SESSION_COOLDOWN_MS = 20 * 60 * 1000;
const AUTO_SYNC_SESSION_KEY_PREFIX = "gitrank:auto-sync:last-at:";

export function DashboardTopBarContainer() {
  const { data, isError, isLoading } = useMyProfile();
  const { mutate: runUserSync, isPending: isUserSyncPending } = useRunUserSync();
  const autoSyncLastAttempt = useRef(0);
  const autoSyncAttempts = useRef(0);
  const lastObservedSyncState = useRef<string | null>(null);
  const [autoSyncOutcome, setAutoSyncOutcome] = useState<AutoSyncNote | null>(null);
  useAccountGamificationPreference(data);

  useEffect(() => {
    if (isLoading || isError || !data) {
      return;
    }
    const syncState = data.user.syncStatus;
    if (lastObservedSyncState.current !== syncState.state) {
      lastObservedSyncState.current = syncState.state;
      autoSyncAttempts.current = 0;
    }
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
      if (now - autoSyncLastAttempt.current >= AUTO_SYNC_ATTEMPT_RECOVERY_COOLDOWN_MS) {
        autoSyncAttempts.current = 0;
      } else {
        return;
      }
    }
    if (now - autoSyncLastAttempt.current < AUTO_SYNC_RETRY_INTERVAL_MS) {
      return;
    }
    if (typeof window !== "undefined") {
      const sessionKey = `${AUTO_SYNC_SESSION_KEY_PREFIX}${data.user.username.toLowerCase()}`;
      const lastSessionAttempt = Number(window.sessionStorage.getItem(sessionKey) ?? "");
      if (Number.isFinite(lastSessionAttempt) && now-lastSessionAttempt < AUTO_SYNC_SESSION_COOLDOWN_MS) {
        return;
      }
      window.sessionStorage.setItem(sessionKey, String(now));
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
            message: "Sync queued. Evidence will refresh in the background.",
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
          message: "Profile sync completed.",
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
              ? `Sync retry scheduled (${attemptsRemaining} retries left).`
              : "Sync keeps failing. Reconnect GitHub in Settings.",
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
      message: "Background sync running.",
    }
    : data.user.syncStatus.state === "syncing"
      ? {
        tone: "info",
        message: "Profile sync already in progress.",
      }
      : autoSyncOutcome;

  return (
    <DashboardTopBar
      user={data.user}
      autoSyncNote={autoSyncNote}
    />
  );
}
