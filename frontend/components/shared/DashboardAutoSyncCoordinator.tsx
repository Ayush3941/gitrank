"use client";

import { useEffect, useRef } from "react";
import { useRequestProfileSync } from "@/hooks/use-account-actions";
import { useAccountGamificationPreference } from "@/hooks/use-gamification-preference";
import { useMyProfile } from "@/hooks/use-profile";
import { useProfileSyncRuns } from "@/hooks/use-profile-sync-runs";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import {
  deriveEffectiveSyncState,
  selectProfileSyncRunStatuses,
} from "@/lib/presentation/sync-evidence";
import { syncPollingPolicy } from "@/lib/runtime/sync-polling-policy";
import { frontendPolicy } from "@/lib/runtime/frontend-policy";

const AUTO_SYNC_SESSION_KEY_PREFIX = "gitrank:auto-sync:last-at:";
const AUTO_SYNC_SESSION_BOOTSTRAP_KEY_PREFIX = "gitrank:auto-sync:bootstrap:";

export function DashboardAutoSyncCoordinator() {
  const { data, isError, isLoading } = useMyProfile();
  const syncRunsQuery = useProfileSyncRuns();
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
    const effectiveSyncState = deriveEffectiveSyncState(
      data.user,
      selectProfileSyncRunStatuses(syncRunsQuery.data?.runs, data.user),
    );
    if (lastObservedSyncState.current !== effectiveSyncState) {
      lastObservedSyncState.current = effectiveSyncState;
      autoSyncAttempts.current = 0;
    }

    const now = Date.now();
    const lastSyncedAt = Date.parse(syncState.lastSyncedAt ?? "");
    const syncAgeMs = Number.isNaN(lastSyncedAt) ? Number.POSITIVE_INFINITY : now - lastSyncedAt;
    const staleSnapshot = effectiveSyncState !== "synced";
    const staleByAge = syncAgeMs >= syncPollingPolicy.autoSyncStaleAgeMs;
    const usernameKey = data.user.username.toLowerCase();
    const sessionFingerprint = readSessionFingerprint();
    const bootstrapSessionKey = `${AUTO_SYNC_SESSION_BOOTSTRAP_KEY_PREFIX}${usernameKey}:${sessionFingerprint}`;
    const hasSessionBootstrapAttempt =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(bootstrapSessionKey) === "1";
    const shouldBootstrapSessionSync =
      syncPollingPolicy.autoSyncSessionBootstrapEnabled && !hasSessionBootstrapAttempt;
    const shouldAutoSync = shouldBootstrapSessionSync || staleSnapshot || staleByAge;

    if (!shouldAutoSync || effectiveSyncState === "syncing" || isUserSyncPending) {
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
      if (!shouldBootstrapSessionSync) {
        const sessionKey = `${AUTO_SYNC_SESSION_KEY_PREFIX}${usernameKey}`;
        const lastSessionAttempt = Number(window.sessionStorage.getItem(sessionKey) ?? "");
        if (
          Number.isFinite(lastSessionAttempt) &&
          now - lastSessionAttempt < syncPollingPolicy.autoSyncSessionCooldownMs
        ) {
          return;
        }
      }
      window.sessionStorage.setItem(`${AUTO_SYNC_SESSION_KEY_PREFIX}${usernameKey}`, String(now));
      if (shouldBootstrapSessionSync) {
        window.sessionStorage.setItem(bootstrapSessionKey, "1");
      }
    }

    autoSyncLastAttempt.current = now;
    autoSyncAttempts.current += 1;
    requestProfileSync(undefined, {
      onSuccess: () => {
        autoSyncLastAttempt.current = Date.now();
        autoSyncAttempts.current = 0;
        void emitAnalyticsEvent({
          eventName: shouldBootstrapSessionSync ? "sync.session_bootstrap" : "sync.queued",
          source: "frontend",
          target: "dashboard",
          status: "success",
        });
      },
      onError: () => {
        const attemptsRemaining = syncPollingPolicy.autoSyncMaxAttemptsPerMount - autoSyncAttempts.current;
        void emitAnalyticsEvent({
          eventName: shouldBootstrapSessionSync ? "sync.session_bootstrap" : "sync.failed",
          source: "frontend",
          target: "dashboard",
          status: "failure",
        });
        if (attemptsRemaining <= 0 && typeof window !== "undefined") {
          const sessionKey = `${AUTO_SYNC_SESSION_KEY_PREFIX}${usernameKey}`;
          window.sessionStorage.setItem(sessionKey, String(Date.now()));
        }
      },
    });
  }, [
    data,
    isError,
    isLoading,
    isUserSyncPending,
    requestProfileSync,
    syncRunsQuery.data?.runs,
  ]);

  return null;
}

function readSessionFingerprint(): string {
  if (typeof document === "undefined") {
    return "server";
  }
  const token = readCookieValue(frontendPolicy.csrfCookieName);
  if (!token) {
    return "missing-csrf";
  }
  return token.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "present";
}

function readCookieValue(name: string): string | null {
  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  if (!match) {
    return null;
  }
  return decodeURIComponent(match.slice(name.length + 1));
}
