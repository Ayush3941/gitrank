"use client";

import { GlowCard } from "@/components/shared/GlowCard";
import { cn } from "@/lib/cn";
import { formatLoadingAnnouncement, normalizeLoadingTarget } from "@/lib/presentation/loading-copy";
import { buildStableRenderRows } from "@/lib/presentation/render-identity";

type SkeletonBar = {
  id?: string;
  className: string;
};

const DEFAULT_SKELETONS: SkeletonBar[] = [
  { id: "headline", className: "h-10 w-3/5" },
  { id: "body", className: "h-24 w-full" },
];

export function PanelLoadingPlaceholder({
  label,
  minHeightClassName = "min-h-[15rem]",
  skeletons = DEFAULT_SKELETONS,
  surface = "card",
  cardVariant = "default",
  className,
}: {
  label: string;
  minHeightClassName?: string;
  skeletons?: SkeletonBar[];
  surface?: "card" | "plain";
  cardVariant?: "default" | "loading";
  className?: string;
}) {
  const loadingTarget = normalizeLoadingTarget(label);
  const skeletonRows = buildStableRenderRows(
    skeletons,
    (skeleton) => `skeleton:${skeleton.className}`,
    (skeleton) => skeleton.id,
  );
  const body = (
    <>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {formatLoadingAnnouncement(loadingTarget)}
      </span>
      <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
        <span className="neon-chip neon-chip-info inline-flex rounded-full px-3 py-1 text-sm font-semibold">
          Loading
        </span>
        <span className="text-sm font-semibold text-white">{loadingTarget}</span>
      </div>
      {skeletonRows.map(({ renderId, item: skeleton }) => (
        <div
          key={renderId}
          className={cn("neon-skeleton", skeleton.className)}
          aria-hidden="true"
        />
      ))}
    </>
  );
  const shellClassName = cn(minHeightClassName, "space-y-3", className);

  if (surface === "plain") {
    return (
      <div className={shellClassName} aria-busy="true">
        {body}
      </div>
    );
  }

  return (
    <GlowCard variant={cardVariant} className={shellClassName} aria-busy="true">
      {body}
    </GlowCard>
  );
}
