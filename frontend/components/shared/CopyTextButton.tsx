"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

export function CopyTextButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  manualLabel = "Copy manually",
  errorLabel = "Copy failed",
  analyticsTarget = "copy-text",
  size = "sm",
  variant = "ghost",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  manualLabel?: string;
  errorLabel?: string;
  analyticsTarget?: string;
  size?: "sm" | "md" | "lg" | "icon";
  variant?: "default" | "secondary" | "ghost" | "danger";
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual" | "error">("idle");
  const timerRef = useRef<number | undefined>(undefined);
  const liveAnnouncement =
    state === "idle"
      ? ""
      : state === "copied"
        ? copiedLabel
        : state === "manual"
          ? manualLabel
          : errorLabel;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setState("copied");
        void emitAnalyticsEvent({
          eventName: "copy_text.used",
          source: "frontend",
          target: analyticsTarget,
          status: "success",
        });
        scheduleReset();
        return;
      }

      window.prompt("Copy text", text);
      setState("manual");
      void emitAnalyticsEvent({
        eventName: "copy_text.used",
        source: "frontend",
        target: `${analyticsTarget}/manual`,
        status: "success",
      });
      scheduleReset();
    } catch {
      setState("error");
      void emitAnalyticsEvent({
        eventName: "copy_text.used",
        source: "frontend",
        target: `${analyticsTarget}/error`,
        status: "failure",
      });
      scheduleReset();
    }
  }

  function scheduleReset() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setState("idle");
    }, 1400);
  }

  const currentLabel =
    state === "copied"
      ? copiedLabel
      : state === "manual"
        ? manualLabel
        : state === "error"
          ? errorLabel
          : label;
  const stableWidth = size !== "icon";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handleCopy}
        className={cn(stableWidth ? "min-w-[8.5rem] justify-center" : undefined)}
      >
        {state === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {currentLabel}
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </span>
    </div>
  );
}
