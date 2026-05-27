"use client";

import { useMemo } from "react";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import {
  deriveEffectiveSyncState,
  selectProfileSyncRunStatuses,
  shouldShowSyncRefreshPill,
} from "@/lib/presentation/sync-evidence";
import type { UserProfile } from "@/types/gitrank";

export function useProfileSyncState(
  user: UserProfile | null | undefined,
  runs: readonly ApiSyncRunRecord[] | null | undefined,
) {
  const syncRunStatuses = useMemo(
    () => selectProfileSyncRunStatuses(runs, user),
    [runs, user],
  );
  const syncStateForDisplay = useMemo(
    () => deriveEffectiveSyncState(user, syncRunStatuses),
    [syncRunStatuses, user],
  );
  const showRefreshPill = useMemo(
    () => shouldShowSyncRefreshPill(user, syncRunStatuses),
    [syncRunStatuses, user],
  );

  return {
    syncRunStatuses,
    syncStateForDisplay,
    showRefreshPill,
  };
}
