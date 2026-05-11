"use client";

import {
  RevealPanel,
  RevealPanelSkeleton,
  RevealPanelUnavailable,
} from "@/features/onboarding/components/RevealPanel";
import { useAccountGamificationPreference } from "@/hooks/use-gamification-preference";
import { useMyProfile } from "@/hooks/use-profile";

export function RevealPanelContainer() {
  const { data, isError, isLoading } = useMyProfile();
  useAccountGamificationPreference(data);

  if (isLoading) {
    return <RevealPanelSkeleton />;
  }

  if (isError || !data) {
    return <RevealPanelUnavailable />;
  }

  return <RevealPanel user={data.user} />;
}
