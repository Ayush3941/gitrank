"use client";

import { useEffect, useRef } from "react";
import { useRequestProfileSync } from "@/hooks/use-account-actions";
import { useAccountGamificationPreference } from "@/hooks/use-gamification-preference";
import { useMyProfile } from "@/hooks/use-profile";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { syncPollingPolicy } from "@/lib/runtime/sync-polling-policy";

const AUTO_SYNC_SESSION_KEY_PREFIX = "gitrank:auto-sync:last-at:";

export function DashboardAutoSyncCoordinator() {
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
    const staleByAge = syncAgeMs >= syncPollingPolicy.autoSyncStaleAgeMs;
    const emptyEvidence = data.user.mergedPrCount === 0;
    const shouldAutoSync = staleSnapshot || staleByAge || emptyEvidence;

    if (!shouldAutoSync || syncState.state === "syncing" || isUserSyncPending) {
      return;
    }

    if (autoSyncAttempts.current >= syncPollingPolicy.autoSyncMaxAttemptsPerMount) {
      if (now - autoSyncLastAttempt.current >= syncPollingPolicy.autoSyncAttemptRecoveryCooldownMs) {
        autoSyncAttempts.current = 0;
      } else {
        return;
      }
    }

    if (now - autoSyncLastAttempt.current < syncPollingPolicy.autoSyncRetryIntervalMs) {
      return;
    }

    if (typeof window !== "undefined") {
      const sessionKey = `${AUTO_SYNC_SESSION_KEY_PREFIX}${data.user.username.toLowerCase()}`;
      const lastSessionAttempt = Number(window.sessionStorage.getItem(sessionKey) ?? "");
      if (
        Number.isFinite(lastSessionAttempt) &&
        now - lastSessionAttempt < syncPollingPolicy.autoSyncSessionCooldownMs
      ) {
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
        const attemptsRemaining = syncPollingPolicy.autoSyncMaxAttemptsPerMount - autoSyncAttempts.current;
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

  return null;
}
