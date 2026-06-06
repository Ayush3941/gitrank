"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useMemo, useState } from "react";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { GlowCard } from "@/components/shared/GlowCard";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { syncRunStatusLabelWithMetrics } from "@/features/settings/lib/sync-run-status";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";

const SyncRunActivityPanel = dynamic(
  () =>
    import("@/features/settings/components/SyncRunActivityPanel").then(
      (mod) => mod.SyncRunActivityPanel,
    ),
  {
    loading: () => <SettingsPanelPlaceholder label="Loading sync activity" />,
  },
);

export function SettingsSyncActivitySection({
  runs,
  lastUpdatedAt,
  lastAttemptedAt,
  lastSuccessfulAt,
  isLoading,
  isRefreshing,
  isError,
  errorMessage,
  onRefresh,
}: {
  runs: ApiSyncRunRecord[];
  lastUpdatedAt: string | undefined;
  lastAttemptedAt: string | undefined;
  lastSuccessfulAt: string | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  errorMessage: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [autoExpandedFromAttention, setAutoExpandedFromAttention] = useState(false);
  const syncActivityToggleId = useId();
  const syncActivityDetailsId = useId();

  const summary = useMemo(() => {
    let completed = 0;
    let running = 0;
    let queued = 0;
    let partial = 0;
    let failed = 0;
    for (const run of runs) {
      const status = syncRunStatusLabelWithMetrics(run.status, run.metrics);
      if (status === "Completed") {
        completed += 1;
      } else if (status === "Running") {
        running += 1;
      } else if (status === "Queued") {
        queued += 1;
      } else if (status === "Partial") {
        partial += 1;
      } else if (status === "Failed") {
        failed += 1;
      }
    }
    return { completed, running, queued, partial, failed };
  }, [runs]);

  const attentionLabel =
    summary.failed > 0
      ? `${summary.failed} failed`
      : summary.partial > 0
        ? `${summary.partial} partial`
        : summary.running > 0 || summary.queued > 0
          ? `${summary.running + summary.queued} active`
          : "Healthy";
  const hasAttention = summary.failed > 0 || summary.partial > 0;

  useEffect(() => {
    if (!hasAttention || autoExpandedFromAttention) {
      return;
    }
    const timer = window.setTimeout(() => {
      setExpanded(true);
      setAutoExpandedFromAttention(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [autoExpandedFromAttention, hasAttention]);

  return (
    <GlowCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">Sync history</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Sync activity</h2>
          <p className="mt-2 text-sm text-muted">
            Review recent runs, errors, and GitHub fetch outcomes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={syncActivityAttentionClassName(summary)}>
            {attentionLabel}
          </span>
          <DisclosureToggle
            id={syncActivityToggleId}
            controlsId={syncActivityDetailsId}
            expanded={expanded}
            onToggle={() => {
              setExpanded((current) => !current);
            }}
            collapsedLabel="Show details"
            expandedLabel="Hide details"
            iconClassName="h-4 w-4"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SyncActivityCountChip label="Runs" value={runs.length} />
        <SyncActivityCountChip label="Completed" value={summary.completed} />
        <SyncActivityCountChip label="Active" value={summary.running + summary.queued} />
        <SyncActivityCountChip label="Partial" value={summary.partial} />
        <SyncActivityCountChip label="Failed" value={summary.failed} />
      </div>
      <div
        id={syncActivityDetailsId}
        role="region"
        aria-labelledby={syncActivityToggleId}
        hidden={!expanded}
        className="block"
      >
        {expanded ? (
          <SyncRunActivityPanel
            runs={runs}
            lastUpdatedAt={lastUpdatedAt}
            lastAttemptedAt={lastAttemptedAt}
            lastSuccessfulAt={lastSuccessfulAt}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            isError={isError}
            errorMessage={errorMessage}
            onRefresh={onRefresh}
          />
        ) : null}
      </div>
    </GlowCard>
  );
}

function SyncActivityCountChip({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span className="neon-chip neon-chip-muted inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
      {label} {value}
    </span>
  );
}

function syncActivityAttentionClassName(summary: {
  failed: number;
  partial: number;
  running: number;
  queued: number;
}) {
  if (summary.failed > 0 || summary.partial > 0) {
    return "neon-chip neon-chip-warning inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";
  }
  if (summary.running > 0 || summary.queued > 0) {
    return "neon-chip neon-chip-info inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";
  }
  return "neon-chip neon-chip-success inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";
}

function SettingsPanelPlaceholder({ label }: { label: string }) {
  return (
    <PanelLoadingPlaceholder
      label={label}
      surface="plain"
      skeletons={[
        { className: "h-9 w-1/2" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
