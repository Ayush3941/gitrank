"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/cn";

type InPageSection = {
  id: string;
  label: string;
};

export function InPageSectionNav({
  sections,
  className,
  title = "On this page",
}: {
  sections: InPageSection[];
  className?: string;
  title?: string;
}) {
  const titleId = useId();
  const uniqueSections = useMemo(() => {
    const seen = new Set<string>();
    return sections.filter((section) => {
      const normalizedId = section.id.trim();
      if (!normalizedId || seen.has(normalizedId)) {
        return false;
      }
      seen.add(normalizedId);
      return true;
    });
  }, [sections]);

  if (uniqueSections.length < 2) {
    return null;
  }

  return (
    <nav
      aria-labelledby={titleId}
      className={cn("neon-surface space-y-3 px-4 py-3", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={titleId} className="text-xs font-medium text-primary">
          {title}
        </p>
        <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs font-semibold">
          {uniqueSections.length} sections
        </span>
      </div>
      <ul
        role="list"
        className="dashboard-nav-track scroll-fade-x scroll-fade-x-sm-hide flex max-w-full items-center gap-2 overflow-x-auto pb-[0.12rem] sm:flex-wrap sm:overflow-visible sm:pb-0"
      >
        {uniqueSections.map((section) => (
          <li key={section.id} className="list-none shrink-0 sm:shrink">
            <a
              href={`#${section.id}`}
              data-scroll-target="true"
              className="focus-ring neon-chip neon-chip-muted inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
