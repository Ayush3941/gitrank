"use client";

import dynamic from "next/dynamic";
import { CompactEmptyState } from "@/components/shared/CompactEmptyState";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import {
  formatSignedNumber,
  formatSignedXp,
  formatXp,
  formatXpLabel,
} from "@/lib/formatters";

type TimelinePoint = {
  label: string;
  xp: number;
};

const TimelineChart = dynamic(
  () =>
    import("@/components/shared/TimelineChart").then(
      (mod) => mod.TimelineChart,
    ),
  {
    loading: () => <PublicProfileTimelinePlaceholder />,
  },
);

export function PublicProfileTimelineCard({
  timeline,
  trendWindowLabel,
  constrainedNetwork,
}: {
  timeline: TimelinePoint[];
  trendWindowLabel: string;
  constrainedNetwork: boolean;
}) {
  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Timeline</p>
        <h2 className="mt-2 text-xl font-semibold text-white">XP timeline</h2>
        <p className="mt-1 text-sm text-muted">{trendWindowLabel}</p>
      </div>
      {timeline.length === 0 ? (
        <CompactEmptyState
          title="No timeline signal yet"
          description="Timeline signal appears here after more scored history is synced."
          primaryAction={{
            label: "Open contributions",
            href: "/dashboard/contributions",
            prefetchMode: "never",
          }}
        />
      ) : constrainedNetwork ? (
        <PublicProfileLiteTimelineSummary timeline={timeline} />
      ) : (
        <DeferUntilVisible fallback={<PublicProfileTimelinePlaceholder />}>
          <TimelineChart data={timeline} />
        </DeferUntilVisible>
      )}
    </GlowCard>
  );
}

function PublicProfileLiteTimelineSummary({
  timeline,
}: {
  timeline: TimelinePoint[];
}) {
  if (timeline.length === 0) {
    return (
      <CompactEmptyState
        title="No timeline signal yet"
        description="Timeline signal appears here after more scored history is synced."
      />
    );
  }

  const recent = timeline.slice(-6);
  const first = recent[0];
  const latest = recent[recent.length - 1];
  const previous = recent.length > 1 ? recent[recent.length - 2] : null;
  const delta = previous ? latest.xp - previous.xp : 0;
  const windowDelta = latest.xp - first.xp;
  const momentumLabel = delta > 0 ? "Rising" : delta < 0 ? "Cooling" : "Flat";

  return (
    <div className="space-y-3">
      <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">Latest XP snapshot</p>
          <span className="neon-chip neon-chip-muted rounded-full px-2.5 py-1 text-xs font-semibold">
            {momentumLabel}
          </span>
        </div>
        <p className="mt-1 text-lg font-semibold text-white">
          {formatXpLabel(latest.xp)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {latest.label}
          {previous ? ` \u2022 ${formatSignedNumber(delta)} vs previous` : ""}
        </p>
        <p className="mt-1 text-xs text-muted">
          Recent window change: {formatSignedXp(windowDelta)}
        </p>
      </div>
      <ul role="list" className="space-y-2">
        {recent.map((point, index) => (
          <li
            key={`${point.label}-${index}`}
            className="neon-surface flex items-center justify-between gap-3 rounded-[var(--radius-universal)] px-4 py-2.5"
          >
            <p className="text-sm text-muted">{point.label}</p>
            <p className="text-sm font-semibold text-white">{formatXp(point.xp)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PublicProfileTimelinePlaceholder() {
  return (
    <PanelLoadingPlaceholder
      label="Loading timeline"
      minHeightClassName="min-h-[16rem]"
      skeletons={[
        { className: "h-10 w-2/5" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
