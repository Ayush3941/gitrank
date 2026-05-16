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

export function DashboardTopBarContainer() {
  const { data, isError, isLoading } = useMyProfile();
  const { mutate: runUserSync, isPending: isUserSyncPending } = useRunUserSync();
  const autoSyncRequested = useRef<string>("");
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

    const syncKey = `${data.user.username}:${data.user.syncStatus.state}`;
    if (autoSyncRequested.current === syncKey) {
      return;
    }
    autoSyncRequested.current = syncKey;
    runUserSync(data.user.username);
  }, [data, isError, isLoading, isUserSyncPending, runUserSync]);

  if (isLoading) {
    return <DashboardTopBarSkeleton />;
  }

  if (isError || !data) {
    return <DashboardTopBarUnavailable />;
  }

  return <DashboardTopBar user={data.user} />;
}
