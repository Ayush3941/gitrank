"use client";

import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";

export function PRReportImpactSummaryCard({
  label,
  summary,
  fallbackDetail,
}: {
  label: string;
  summary: string;
  fallbackDetail: string | null;
}) {
  return (
    <GlowCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-primary">{label}</p>
        <CopyTextButton
          text={summary}
          label="Copy impact summary"
          copiedLabel="Summary copied"
          analyticsTarget="pr-report/ai-summary"
          size="sm"
          variant="ghost"
        />
      </div>
      {fallbackDetail ? (
        <p className="rounded-full border border-amber-400/24 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100">
          ChatGPT unavailable ({fallbackDetail}). Showing deterministic summary.
        </p>
      ) : null}
      <ExpandableText
        text={summary}
        lines={5}
        minLengthForToggle={260}
        textClassName="break-anywhere text-base leading-8 text-muted"
      />
    </GlowCard>
  );
}
