import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type FilterResetAction = {
  enabled?: boolean;
  disabled?: boolean;
  onReset: () => void;
  label?: string;
  ariaControls?: string;
};

export function FilterControlsHeader({
  label,
  labelId,
  summary,
  activeFilterCount = 0,
  activeCountLabel,
  secondaryLabel,
  extraControls,
  resetAction,
}: {
  label: string;
  labelId?: string;
  summary: string;
  activeFilterCount?: number;
  activeCountLabel?: string;
  secondaryLabel?: string;
  extraControls?: ReactNode;
  resetAction?: FilterResetAction;
}) {
  const showReset = resetAction && (resetAction.enabled ?? true);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={labelId} className="text-xs font-medium text-primary">
          {label}
        </p>
        <p className="text-xs text-muted">{summary}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {activeFilterCount > 0 ? (
          <span className="neon-chip neon-chip-muted inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
            {activeCountLabel ?? `Active: ${activeFilterCount}`}
          </span>
        ) : null}
        {secondaryLabel ? (
          <span className="neon-chip neon-chip-muted inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
            {secondaryLabel}
          </span>
        ) : null}
        {extraControls}
        {showReset ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={resetAction.onReset}
            disabled={resetAction.disabled}
            aria-controls={resetAction.ariaControls}
            className="h-8 px-3"
          >
            {resetAction.label ?? "Reset"}
          </Button>
        ) : null}
      </div>
    </>
  );
}
