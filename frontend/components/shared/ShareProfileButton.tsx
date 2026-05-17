"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

type ButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "children">;

export function ShareProfileButton({
  username,
  displayName,
  shareHeadline,
  label = "Share profile",
  copiedLabel = "Link copied",
  sharedLabel = "Shared",
  analyticsTargetPrefix = "profile",
  preferNativeShare = true,
  ...buttonProps
}: ButtonProps & {
  username: string;
  displayName: string;
  shareHeadline?: string;
  label?: string;
  copiedLabel?: string;
  sharedLabel?: string;
  analyticsTargetPrefix?: string;
  preferNativeShare?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "shared">("idle");
  const resetTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleShare() {
    const url = `${window.location.origin}/u/${encodeURIComponent(username)}`;

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
      } catch {
        // Fallback to clipboard path.
      }
    }

    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      window.prompt("Copy this profile URL", url);
      return;
    }

    setState("copied");
    void emitAnalyticsEvent({
      eventName: "profile.shared",
      source: "frontend",
      target: `${analyticsTargetPrefix}/copy-link`,
      status: "success",
    });
    scheduleReset();
  }

  function scheduleReset() {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setState("idle");
    }, 1600);
  }

  return (
    <Button {...buttonProps} onClick={handleShare}>
      <Share2 className="h-4 w-4" />
      {state === "copied" ? copiedLabel : state === "shared" ? sharedLabel : label}
    </Button>
  );
}
