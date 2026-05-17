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

export function DashboardTopBarContainer() {
  const { data, isError, isLoading } = useMyProfile();
  const { mutate: requestProfileSync, isPending: isProfileSyncPending } = useRequestProfileSync();
  const autoSyncLastAttempt = useRef(0);
  const autoSyncAttempts = useRef(0);
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
    if (isProfileSyncPending) {
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
    requestProfileSync(undefined, {
      onSuccess: () => {
        void emitAnalyticsEvent({
          eventName: "sync.succeeded",
          source: "frontend",
          target: "dashboard",
          status: "success",
        });
      },
      onError: () => {
        void emitAnalyticsEvent({
          eventName: "sync.failed",
          source: "frontend",
          target: "dashboard",
          status: "failure",
        });
      },
    });
  }, [data, isError, isLoading, isProfileSyncPending, requestProfileSync]);

  if (isLoading) {
    return <DashboardTopBarSkeleton />;
  }

  if (isError || !data) {
    return <DashboardTopBarUnavailable />;
  }

  return <DashboardTopBar user={data.user} />;
}
