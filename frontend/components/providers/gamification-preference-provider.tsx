"use client";

import type { ReactNode } from "react";
import { useApplyGamificationPreference } from "@/hooks/use-gamification-preference";

export function GamificationPreferenceProvider({ children }: { children: ReactNode }) {
  useApplyGamificationPreference();
  return children;
}
