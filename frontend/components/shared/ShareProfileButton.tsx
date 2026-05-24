"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { cn } from "@/lib/cn";

type ButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "children">;

export function ShareProfileButton({
  username,
  displayName,
  shareHeadline,
  label = "Share profile",
  copiedLabel = "Link copied",
  sharedLabel = "Shared",
  manualLabel = "Copy manually",
  errorLabel = "Share failed",
  analyticsTargetPrefix = "profile",
  preferNativeShare = true,
  className,
  ...buttonProps
}: ButtonProps & {
  username: string;
  displayName: string;
  shareHeadline?: string;
  label?: string;
  copiedLabel?: string;
  sharedLabel?: string;
  manualLabel?: string;
  errorLabel?: string;
  analyticsTargetPrefix?: string;
  preferNativeShare?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "shared" | "manual" | "error">("idle");
  const resetTimerRef = useRef<number | undefined>(undefined);
  const liveAnnouncement =
    state === "idle"
      ? ""
      : state === "copied"
        ? copiedLabel
        : state === "shared"
          ? sharedLabel
          : state === "manual"
            ? manualLabel
            : errorLabel;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleShare() {
    const url = `${window.location.origin}/u/${encodeURIComponent(username)}`;

    try {
      if (
        preferNativeShare &&
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        try {
          await navigator.share({
            title: `${displayName} on GitRank`,
            text: shareHeadline,
            url,
          });
          setState("shared");
          void emitAnalyticsEvent({
            eventName: "profile.shared",
            source: "frontend",
            target: `${analyticsTargetPrefix}/native-share`,
            status: "success",
          });
          scheduleReset();
          return;
        } catch (error) {
          if (isShareCanceledError(error)) {
            return;
          }
          // Fallback to clipboard/manual path for non-cancel failures.
        }
      }

      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setState("copied");
        void emitAnalyticsEvent({
          eventName: "profile.shared",
          source: "frontend",
          target: `${analyticsTargetPrefix}/copy-link`,
          status: "success",
        });
        scheduleReset();
        return;
      }

      window.prompt("Copy this profile URL", url);
      setState("manual");
      void emitAnalyticsEvent({
        eventName: "profile.shared",
        source: "frontend",
        target: `${analyticsTargetPrefix}/manual-copy`,
        status: "success",
      });
      scheduleReset();
    } catch {
      setState("error");
      void emitAnalyticsEvent({
        eventName: "profile.shared",
        source: "frontend",
        target: `${analyticsTargetPrefix}/error`,
        status: "failure",
      });
      scheduleReset();
    }
  }

  function scheduleReset() {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setState("idle");
    }, 1600);
  }

  const currentLabel =
    state === "copied"
      ? copiedLabel
      : state === "shared"
        ? sharedLabel
        : state === "manual"
          ? manualLabel
          : state === "error"
            ? errorLabel
            : label;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        {...buttonProps}
        className={cn("min-w-[9rem] justify-center", className)}
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4" />
        {currentLabel}
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </span>
    </div>
  );
}

function isShareCanceledError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { name?: unknown };
  return typeof candidate.name === "string" && candidate.name === "AbortError";
}
