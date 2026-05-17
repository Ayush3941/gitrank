"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

export function CopyTextButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  analyticsTarget = "copy-text",
  size = "sm",
  variant = "ghost",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  analyticsTarget?: string;
  size?: "sm" | "md" | "lg" | "icon";
  variant?: "default" | "secondary" | "ghost" | "danger";
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      window.prompt("Copy text", text);
      return;
    }

    setCopied(true);
    void emitAnalyticsEvent({
      eventName: "copy_text.used",
      source: "frontend",
      target: analyticsTarget,
      status: "success",
    });
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 1400);
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleCopy}
      aria-live="polite"
      aria-atomic="true"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
