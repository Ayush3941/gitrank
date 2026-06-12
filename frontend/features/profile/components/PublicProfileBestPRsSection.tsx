"use client";

import dynamic from "next/dynamic";
import { CompactEmptyState } from "@/components/shared/CompactEmptyState";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { formatSignedXp } from "@/lib/formatters";
import { formatContributionStatusLabel } from "@/lib/presentation/contribution-status";
import type { FeaturedContribution, PullRequestAnalysis } from "@/types/gitrank";

const BestPRsPanel = dynamic(
  () =>
    import("@/features/profile/components/BestPRsPanel").then(
      (mod) => mod.BestPRsPanel,
    ),
  {
    loading: () => <PublicProfileBestPRsPlaceholder />,
  },
);

export function PublicProfileBestPRsSection({
  reports,
  reportDetails,
  constrainedNetwork,
}: {
  reports: FeaturedContribution[];
  reportDetails: PullRequestAnalysis[];
  constrainedNetwork: boolean;
}) {
  return constrainedNetwork ? (
    <PublicProfileLiteBestPRSummary reports={reports} />
  ) : (
    <DeferUntilVisible fallback={<PublicProfileBestPRsPlaceholder />}>
      <BestPRsPanel reports={reports} reportDetails={reportDetails} />
    </DeferUntilVisible>
  );
}

function PublicProfileLiteBestPRSummary({
  reports,
}: {
  reports: FeaturedContribution[];
}) {
  if (reports.length === 0) {
    return (
      <GlowCard className="space-y-3">
        <CompactEmptyState
          title="No visible PR evidence"
          description="This profile snapshot has no public battle reports to display."
          primaryAction={{
            label: "Open contributions",
            href: "/dashboard/contributions",
            prefetchMode: "never",
          }}
        />
      </GlowCard>
    );
  }

  return (
    <GlowCard className="space-y-4">
      <ul role="list" className="space-y-3">
        {reports.slice(0, 4).map((report) => (
          <li
            key={report.id}
            className="neon-surface rounded-[var(--radius-universal)] px-4 py-3"
          >
            <p className="break-anywhere text-sm font-medium text-white">{report.title}</p>
            <p className="mt-1 break-anywhere text-xs text-muted">
              {report.owner}/{report.repo} #{report.number}{" "}
              <span aria-hidden="true">{"\u2022"}</span>{" "}
              {formatContributionStatusLabel(report.status)}
            </p>
            <p className="mt-2 text-xs font-semibold text-primary">
              {formatSignedXp(report.xpEarned)}
            </p>
          </li>
        ))}
      </ul>
    </GlowCard>
  );
}

function PublicProfileBestPRsPlaceholder() {
  return (
    <PanelLoadingPlaceholder
      label="Loading battle reports"
      minHeightClassName="min-h-[16rem]"
      skeletons={[
        { className: "h-10 w-2/5" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
