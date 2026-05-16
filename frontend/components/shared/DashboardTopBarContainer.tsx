"use client";

import { useEffect, useRef } from "react";
import {
  DashboardTopBar,
  DashboardTopBarSkeleton,
  DashboardTopBarUnavailable,
} from "@/components/shared/DashboardTopBar";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useAccountGamificationPreference } from "@/hooks/use-gamification-preference";
import { useMyProfile } from "@/hooks/use-profile";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

export function DashboardTopBarContainer() {
  const { data, isError, isLoading } = useMyProfile();
  const { mutate: runUserSync, isPending: isUserSyncPending } = useRunUserSync();
  const autoSyncLastAttempt = useRef(0);
  useAccountGamificationPreference(data);

  useEffect(() => {
    if (isLoading || isError || !data) {
      return;
    }
    if (data.user.syncStatus.state === "synced") {
      return;
    }
    if (isUserSyncPending) {
      return;
    }
    const now = Date.now();
    if (now - autoSyncLastAttempt.current < 90_000) {
      return;
    }
    autoSyncLastAttempt.current = now;
    runUserSync(data.user.username, {
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
  }, [data, isError, isLoading, isUserSyncPending, runUserSync]);

  if (isLoading) {
    return <DashboardTopBarSkeleton />;
  }

  if (isError || !data) {
    return <DashboardTopBarUnavailable />;
  }

  return <DashboardTopBar user={data.user} />;
}
