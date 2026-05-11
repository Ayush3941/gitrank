"use client";

import {
  DashboardTopBar,
  DashboardTopBarSkeleton,
  DashboardTopBarUnavailable,
} from "@/components/shared/DashboardTopBar";
import { useMyProfile } from "@/hooks/use-profile";

export function DashboardTopBarContainer() {
  const { data, isError, isLoading } = useMyProfile();

  if (isLoading) {
    return <DashboardTopBarSkeleton />;
  }

  if (isError || !data) {
    return <DashboardTopBarUnavailable />;
  }

  return <DashboardTopBar user={data.user} />;
}
