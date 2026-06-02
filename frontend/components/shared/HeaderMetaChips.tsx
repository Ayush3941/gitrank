import { cn } from "@/lib/cn";
import { ScrollableRegion } from "@/components/shared/ScrollableRegion";

export type HeaderMetaChipTone = "muted" | "info" | "success" | "warning" | "danger";

export type HeaderMetaChipItem = {
  label: string;
  tone?: HeaderMetaChipTone;
};

export function HeaderMetaChips({
  items,
  className,
  accessibilityLabel = "Page summary metrics",
}: {
  items: readonly HeaderMetaChipItem[];
  className?: string;
  accessibilityLabel?: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <ScrollableRegion
      label={accessibilityLabel}
      className={cn(
        "dashboard-nav-track scroll-fade-x scroll-fade-x-sm-hide max-w-full overflow-x-auto pb-[0.12rem] sm:overflow-visible sm:pb-0",
        className,
      )}
    >
      <ul role="list" className="flex w-max min-w-full items-center gap-2 text-xs sm:w-auto sm:min-w-0 sm:flex-wrap">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="list-none shrink-0 sm:shrink">
            <span className={chipClassName(item.tone)}>{item.label}</span>
          </li>
        ))}
      </ul>
    </ScrollableRegion>
  );
}

function chipClassName(tone: HeaderMetaChipTone | undefined): string {
  if (tone === "info") {
    return "neon-chip neon-chip-info rounded-full px-3 py-1";
  }
  if (tone === "success") {
    return "neon-chip neon-chip-success rounded-full px-3 py-1";
  }
  if (tone === "warning") {
    return "rounded-full border border-amber-400/24 bg-amber-400/12 px-3 py-1 text-amber-100";
  }
  if (tone === "danger") {
    return "rounded-full border border-rose-300/28 bg-rose-500/12 px-3 py-1 text-rose-100";
  }
  return "neon-chip neon-chip-muted rounded-full px-3 py-1";
}
