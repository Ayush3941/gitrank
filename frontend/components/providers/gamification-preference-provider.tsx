"use client";

import type { ReactNode } from "react";
import {
  useApplyGamificationPreference,
  useApplyNetworkConstraintPreference,
} from "@/hooks/use-gamification-preference";

export function GamificationPreferenceProvider({ children }: { children: ReactNode }) {
  useApplyGamificationPreference();
  useApplyNetworkConstraintPreference();
  return children;
}
