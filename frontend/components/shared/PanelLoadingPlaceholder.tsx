"use client";

import { GlowCard } from "@/components/shared/GlowCard";
import { cn } from "@/lib/cn";
import { formatLoadingAnnouncement, normalizeLoadingTarget } from "@/lib/presentation/loading-copy";

type SkeletonBar = {
  className: string;
};

const DEFAULT_SKELETONS: SkeletonBar[] = [
  { className: "h-10 w-3/5" },
  { className: "h-24 w-full" },
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
  const body = (
    <>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {formatLoadingAnnouncement(loadingTarget)}
      </span>
      <p className="text-xs font-medium text-primary" aria-hidden="true">
        {label}
      </p>
      {skeletons.map((skeleton, index) => (
        <div
          key={`${skeleton.className}-${index}`}
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
