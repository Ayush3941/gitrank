"use client";

import { useEffect, useRef } from "react";
import {
  DashboardTopBar,
  DashboardTopBarSkeleton,
  DashboardTopBarUnavailable,
} from "@/components/shared/DashboardTopBar";
import { useRequestProfileSync } from "@/hooks/use-account-actions";
import { useAccountGamificationPreference } from "@/hooks/use-gamification-preference";
import { useMyProfile } from "@/hooks/use-profile";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

const AUTO_SYNC_RETRY_INTERVAL_MS = 90_000;
const AUTO_SYNC_STALE_AGE_MS = 6 * 60 * 60 * 1000;
const AUTO_SYNC_MAX_ATTEMPTS_PER_MOUNT = 3;
const AUTO_SYNC_ATTEMPT_RECOVERY_COOLDOWN_MS = 10 * 60 * 1000;
const AUTO_SYNC_SESSION_COOLDOWN_MS = 20 * 60 * 1000;
const AUTO_SYNC_SESSION_KEY_PREFIX = "gitrank:auto-sync:last-at:";

export function DashboardTopBarContainer({ embedded = false }: { embedded?: boolean }) {
  const { data, isError, isLoading } = useMyProfile();
  const { mutate: requestProfileSync, isPending: isUserSyncPending } = useRequestProfileSync();
  const autoSyncLastAttempt = useRef(0);
  const autoSyncAttempts = useRef(0);
  const lastObservedSyncState = useRef<string | null>(null);
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
    const staleSnapshot = syncState.state !== "synced";
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
      if (Number.isFinite(lastSessionAttempt) && now - lastSessionAttempt < AUTO_SYNC_SESSION_COOLDOWN_MS) {
        return;
      }
      window.sessionStorage.setItem(sessionKey, String(now));
    }
    autoSyncLastAttempt.current = now;
    autoSyncAttempts.current += 1;
    requestProfileSync(undefined, {
      onSuccess: () => {
        autoSyncLastAttempt.current = Date.now();
        autoSyncAttempts.current = 0;
        void emitAnalyticsEvent({
          eventName: "sync.queued",
          source: "frontend",
          target: "dashboard",
          status: "success",
        });
      },
      onError: () => {
        const attemptsRemaining = AUTO_SYNC_MAX_ATTEMPTS_PER_MOUNT - autoSyncAttempts.current;
        void emitAnalyticsEvent({
          eventName: "sync.failed",
          source: "frontend",
          target: "dashboard",
          status: "failure",
        });
        if (attemptsRemaining <= 0 && typeof window !== "undefined") {
          const sessionKey = `${AUTO_SYNC_SESSION_KEY_PREFIX}${data.user.username.toLowerCase()}`;
          window.sessionStorage.setItem(sessionKey, String(Date.now()));
        }
      },
    });
  }, [data, isError, isLoading, isUserSyncPending, requestProfileSync]);

  if (isLoading) {
    return <DashboardTopBarSkeleton embedded={embedded} />;
  }

  if (isError || !data) {
    return <DashboardTopBarUnavailable embedded={embedded} />;
  }

  return <DashboardTopBar user={data.user} embedded={embedded} />;
}
