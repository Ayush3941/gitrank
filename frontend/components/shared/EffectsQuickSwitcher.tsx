"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGamificationPreference } from "@/hooks/use-gamification-preference";

export function EffectsQuickSwitcher({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { reducedGamification, setReducedGamification } = useGamificationPreference();
  const [statusMessage, setStatusMessage] = useState("");
  const clearStatusTimeoutRef = useRef<number | null>(null);
  const nextReducedState = !reducedGamification;
  const currentLabel = reducedGamification ? "Reduced" : "Full";
  const nextLabel = nextReducedState ? "Reduced effects" : "Full effects";

  useEffect(() => {
    return () => {
      if (clearStatusTimeoutRef.current !== null) {
        window.clearTimeout(clearStatusTimeoutRef.current);
      }
    };
  }, []);

  function handleSwitchEffects() {
    setReducedGamification(nextReducedState);
    setStatusMessage(`Visual effects changed to ${nextLabel}.`);
    if (clearStatusTimeoutRef.current !== null) {
      window.clearTimeout(clearStatusTimeoutRef.current);
    }
    clearStatusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage("");
    }, 1200);
  }

  return (
    <>
      <Button
        type="button"
        size={compact ? "sm" : "md"}
        variant="secondary"
        className={className}
        title={`Current effects ${currentLabel}. Switch to ${nextLabel}. Shortcut: Alt+Shift+G.`}
        aria-label={`Visual effects ${currentLabel}. Switch to ${nextLabel}. Shortcut Alt Shift G.`}
        aria-keyshortcuts="Alt+Shift+G"
        onClick={handleSwitchEffects}
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{compact ? currentLabel : `${currentLabel} effects`}</span>
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </span>
    </>
  );
}
