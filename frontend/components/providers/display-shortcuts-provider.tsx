"use client";

import type { ReactNode } from "react";
import { useDisplayShortcutsStatus } from "@/hooks/use-display-shortcuts";

export function DisplayShortcutsProvider({ children }: { children: ReactNode }) {
  const statusMessage = useDisplayShortcutsStatus();

  return (
    <>
      {children}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </span>
    </>
  );
}
