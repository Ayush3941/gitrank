"use client";

import type { ReactNode } from "react";
import { useApplyThemePreference } from "@/hooks/use-theme-preference";

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  useApplyThemePreference();
  return children;
}
