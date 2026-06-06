"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import {
  PRReportBadgeRewardsCard,
  type PRReportBadgeReward,
} from "@/features/pr-report/components/PRReportBadgeRewardsCard";
import { PRReportTechnicalQuickReadCard } from "@/features/pr-report/components/PRReportTechnicalQuickReadCard";
import type { PullRequestAnalysis } from "@/types/gitrank";

const ScoreMatrixCard = dynamic(
  () =>
    import("@/features/pr-report/components/ScoreMatrixCard").then(
      (mod) => mod.ScoreMatrixCard,
    ),
  {
    loading: () => <TechnicalPanelPlaceholder label="Loading score matrix" />,
  },
);

const XPBreakdownCard = dynamic(
  () =>
    import("@/features/pr-report/components/XPBreakdownCard").then(
      (mod) => mod.XPBreakdownCard,
    ),
  {
    loading: () => <TechnicalPanelPlaceholder label="Loading XP breakdown" />,
  },
);

const EvidenceSignalsCard = dynamic(
  () =>
    import("@/features/pr-report/components/EvidenceSignalsCard").then(
      (mod) => mod.EvidenceSignalsCard,
    ),
  {
    loading: () => <TechnicalPanelPlaceholder label="Loading evidence signals" />,
  },
);

export function PRReportTechnicalBreakdownSection({
  report,
  badgeRewards,
}: {
  report: PullRequestAnalysis;
  badgeRewards: PRReportBadgeReward[];
}) {
  const [showTechnicalBreakdown, setShowTechnicalBreakdown] = useState(false);
  const technicalPanelsId = useId();
  const technicalToggleId = useId();

  return (
    <section
      id="pr-report-technical"
      data-scroll-target="true"
      className="render-opt-section space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Technical breakdown</h2>
        <DisclosureToggle
          id={technicalToggleId}
          controlsId={technicalPanelsId}
          expanded={showTechnicalBreakdown}
          onToggle={() => {
            setShowTechnicalBreakdown((current) => !current);
          }}
          collapsedLabel="Show details"
          expandedLabel="Hide details"
        />
      </div>
      <div
        id={technicalPanelsId}
        role="region"
        aria-labelledby={technicalToggleId}
      >
        {showTechnicalBreakdown ? (
          <div className="space-y-6">
            <section className="render-opt-section">
              <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
                <ScoreMatrixCard report={report} />
                <XPBreakdownCard report={report} />
              </div>
            </section>
            <section className="render-opt-section">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-white">Evidence signals</h2>
                <EvidenceSignalsCard report={report} />
              </div>
            </section>
            <PRReportBadgeRewardsCard badges={badgeRewards} />
          </div>
        ) : (
          <PRReportTechnicalQuickReadCard contribution={report.contribution} />
        )}
      </div>
    </section>
  );
}

function TechnicalPanelPlaceholder({ label }: { label: string }) {
  return (
    <PanelLoadingPlaceholder
      label={label}
      minHeightClassName="min-h-[14rem]"
      cardVariant="loading"
      skeletons={[
        { className: "h-10 w-1/2" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
