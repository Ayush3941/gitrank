"use client";

import type { ReactNode } from "react";
import { useDisplayShortcutsEnabled } from "@/hooks/use-display-shortcuts-enabled";
import { useDisplayShortcutsStatus } from "@/hooks/use-display-shortcuts";

export function DisplayShortcutsProvider({ children }: { children: ReactNode }) {
  const { enabled } = useDisplayShortcutsEnabled();
  const statusMessage = useDisplayShortcutsStatus(enabled);

  return (
    <>
      {children}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </span>
    </>
  );
}
