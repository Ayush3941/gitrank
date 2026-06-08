"use client";

import { Download, LayoutList, Rows3 } from "lucide-react";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { Button } from "@/components/ui/button";
import { downloadContributionsCSV } from "@/features/contributions/lib/contribution-csv-export";
import type { Contribution, SyncState } from "@/types/gitrank";

export function ContributionsHeaderActions({
  cardsRegionId,
  rows,
  showFreshness,
  refreshedAt,
  syncState,
  useLiteCards,
  showCardDetails,
  onToggleCardDetails,
  onExportStatusChange,
}: {
  cardsRegionId: string;
  rows: Contribution[];
  showFreshness: boolean;
  refreshedAt?: string;
  syncState: SyncState;
  useLiteCards: boolean;
  showCardDetails: boolean;
  onToggleCardDetails: () => void;
  onExportStatusChange: (message: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ProfileEvidenceStateChip
        showFreshness={showFreshness}
        refreshedAt={refreshedAt}
        syncState={syncState}
      />
      {!useLiteCards ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleCardDetails}
          aria-pressed={showCardDetails}
          aria-controls={cardsRegionId}
        >
          {showCardDetails ? (
            <>
              <Rows3 className="h-4 w-4" aria-hidden="true" />
              Hide details
            </>
          ) : (
            <>
              <LayoutList className="h-4 w-4" aria-hidden="true" />
              Show details
            </>
          )}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          if (!rows.length) {
            onExportStatusChange("No contribution rows are available to export.");
            return;
          }
          downloadContributionsCSV(rows);
          onExportStatusChange(`Exported ${rows.length} contribution rows as CSV.`);
        }}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export CSV
      </Button>
    </div>
  );
}
