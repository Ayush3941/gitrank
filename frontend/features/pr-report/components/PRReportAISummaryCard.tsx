"use client";

import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { GlowCard } from "@/components/shared/GlowCard";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { Button } from "@/components/ui/button";
import { usePRSummary } from "@/features/pr-report/application/use-pr-summary";

export function PRReportAISummaryCard({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}) {
  const { text, status, error, generate, stop } = usePRSummary(owner, repo, number);
  const generating = status === "generating";

  return (
    <GlowCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">AI summary</h2>
        <div className="flex flex-wrap gap-2">
          {status === "complete" ? (
            <CopyTextButton
              text={text}
              label="Copy AI summary"
              copiedLabel="Summary copied"
              analyticsTarget="pr-report/ai-summary"
              size="sm"
              variant="ghost"
            />
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={generating}
            aria-busy={generating || undefined}
            onClick={() => { void generate(); }}
          >
            {generating ? "Generating summary" : text ? "Generate again" : "Generate AI summary"}
          </Button>
          {generating ? (
            <Button type="button" size="sm" variant="ghost" onClick={stop}>Stop</Button>
          ) : null}
        </div>
      </div>
      {!text ? (
        <p className="text-sm leading-6 text-muted">
          Explore what changed and why it matters, explained in plain language.
        </p>
      ) : null}
      <span
        className={status === "stopped" ? "text-sm text-muted" : "sr-only"}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {generating ? "Generating AI summary." : status === "complete" ? "AI summary ready." : status === "stopped" ? "Generation stopped." : ""}
      </span>
      {text ? (
        <p
          aria-busy={generating || undefined}
          className="readable-measure break-anywhere whitespace-pre-line text-base leading-8 text-muted"
        >
          {text}
        </p>
      ) : null}
      {error ? (
        <InlineNotice
          message={error}
          placeholder="AI summary status"
          variant="warning"
          minHeightClassName="min-h-0"
        />
      ) : null}
    </GlowCard>
  );
}
