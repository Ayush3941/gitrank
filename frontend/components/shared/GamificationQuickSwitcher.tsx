"use client";

import { useEffect, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGamificationPreference } from "@/hooks/use-gamification-preference";

export function GamificationQuickSwitcher({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { reducedGamification, setReducedGamification } = useGamificationPreference();
  const [statusMessage, setStatusMessage] = useState("");
  const clearStatusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clearStatusTimeoutRef.current !== null) {
        window.clearTimeout(clearStatusTimeoutRef.current);
      }
    };
  }, []);

  const nextReducedState = !reducedGamification;
  const currentLabel = reducedGamification ? "Reduced" : "Full";
  const nextLabel = nextReducedState ? "Reduced effects" : "Full effects";

  function handleSwitchGamification() {
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
        title={`Effects: ${currentLabel}. Switch to ${nextLabel}. Shortcut: Alt+Shift+G.`}
        aria-label={`Effects ${currentLabel}. Switch to ${nextLabel}. Shortcut Alt Shift G.`}
        aria-keyshortcuts="Alt+Shift+G"
        onClick={handleSwitchGamification}
      >
        <Gauge className="h-4 w-4 text-primary" />
        <span className="text-sm">
          {compact ? (
            <span className="font-semibold">{currentLabel}</span>
          ) : (
            <>
              Effects:
              {" "}
              <span className="font-semibold">{currentLabel}</span>
            </>
          )}
        </span>
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </span>
    </>
  );
}
