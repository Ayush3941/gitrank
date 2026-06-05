"use client";

import Link from "next/link";
import { GlowCard } from "@/components/shared/GlowCard";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { Button } from "@/components/ui/button";

export type ReportProcessingGuidance = {
  tone: "warning" | "info";
  label: string;
  message: string;
  cta: string;
  href: string;
};

export type ReportProcessingRetryNotice = {
  tone: "success" | "warning" | "error";
  message: string;
} | null;

export function ReportProcessingStateCard({
  guidance,
  canRetryAiSummary,
  isRetrying,
  retryNotice,
  onRetryAiSummary,
  onDismissRetryNotice,
}: {
  guidance: ReportProcessingGuidance;
  canRetryAiSummary: boolean;
  isRetrying: boolean;
  retryNotice: ReportProcessingRetryNotice;
  onRetryAiSummary: () => void | Promise<void>;
  onDismissRetryNotice: () => void;
}) {
  return (
    <section className="render-opt-section">
      <GlowCard className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-primary">Report processing state</p>
          <span
            className={
              guidance.tone === "warning"
                ? "neon-chip neon-chip-warning rounded-full px-3 py-1 text-xs font-semibold"
                : "neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold"
            }
          >
            {guidance.label}
          </span>
        </div>
        <p className="text-sm leading-6 text-muted">{guidance.message}</p>
        <div className="flex flex-wrap gap-2">
          {canRetryAiSummary ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isRetrying}
              onClick={() => {
                void onRetryAiSummary();
              }}
            >
              {isRetrying ? "Retrying..." : "Retry AI summary"}
            </Button>
          ) : null}
          <Button asChild size="sm" variant="secondary">
            <Link href={guidance.href} prefetch={false}>
              {guidance.cta}
            </Link>
          </Button>
        </div>
        <InlineNotice
          message={retryNotice?.message}
          variant={retryNotice?.tone ?? "info"}
          placeholder="AI retry status"
          minHeightClassName="min-h-7"
          onDismiss={retryNotice ? onDismissRetryNotice : undefined}
          dismissLabel="Dismiss retry status"
        />
      </GlowCard>
    </section>
  );
}
