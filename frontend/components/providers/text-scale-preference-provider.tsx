"use client";

import type { ReactNode } from "react";
import { useApplyTextScalePreference } from "@/hooks/use-text-scale-preference";

export function TextScalePreferenceProvider({ children }: { children: ReactNode }) {
  useApplyTextScalePreference();
  return children;
}
