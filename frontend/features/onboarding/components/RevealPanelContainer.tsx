"use client";

import {
  RevealPanel,
  RevealPanelSkeleton,
  RevealPanelUnavailable,
} from "@/features/onboarding/components/RevealPanel";
import { useMyProfile } from "@/hooks/use-profile";

export function RevealPanelContainer() {
  const { data, isError, isLoading } = useMyProfile();

  if (isLoading) {
    return <RevealPanelSkeleton />;
  }

  if (isError || !data) {
    return <RevealPanelUnavailable />;
  }

  return <RevealPanel user={data.user} />;
}
