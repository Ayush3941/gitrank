"use client";

import { useEffect, useRef, useState } from "react";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTextScalePreference } from "@/hooks/use-text-scale-preference";

export function TextScaleQuickSwitcher({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { textScale, setTextScale } = useTextScalePreference();
  const [statusMessage, setStatusMessage] = useState("");
  const clearStatusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clearStatusTimeoutRef.current !== null) {
        window.clearTimeout(clearStatusTimeoutRef.current);
      }
    };
  }, []);

  const nextTextScale = textScale === "large" ? "default" : "large";
  const currentLabel = textScale === "large" ? "Large" : "Default";
  const nextLabel = nextTextScale === "large" ? "Large text" : "Default text";

  function handleSwitchTextScale() {
    setTextScale(nextTextScale);
    setStatusMessage(`Text size changed to ${nextLabel}.`);
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
        title={`Text size: ${currentLabel}. Switch to ${nextLabel}.`}
        aria-label={`Text size ${currentLabel}. Switch to ${nextLabel}.`}
        onClick={handleSwitchTextScale}
      >
        <Type className="h-4 w-4 text-primary" />
        <span className="text-sm">
          Text:
          {" "}
          <span className="font-semibold">{currentLabel}</span>
        </span>
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </span>
    </>
  );
}
