import { cn } from "@/lib/cn";

export type HeaderMetaChipTone = "muted" | "info" | "success" | "warning" | "danger";

export type HeaderMetaChipItem = {
  label: string;
  tone?: HeaderMetaChipTone;
};

export function HeaderMetaChips({
  items,
  className,
}: {
  items: readonly HeaderMetaChipItem[];
  className?: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <ul
      role="list"
      className={cn(
        "dashboard-nav-track scroll-fade-x scroll-fade-x-sm-hide flex max-w-full items-center gap-2 overflow-x-auto pb-[0.12rem] text-xs sm:flex-wrap sm:overflow-visible sm:pb-0",
        className,
      )}
    >
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="list-none shrink-0 sm:shrink">
          <span className={chipClassName(item.tone)}>{item.label}</span>
        </li>
      ))}
    </ul>
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
