"use client";

import { useId, useMemo, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { initialSectionFromHash } from "@/lib/section-nav";

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
    return sections.flatMap((section) => {
      const normalizedId = section.id.trim();
      if (!normalizedId || seen.has(normalizedId)) {
        return [];
      }
      seen.add(normalizedId);
      return [{ ...section, id: normalizedId }];
    });
  }, [sections]);
  const fallbackSectionId = uniqueSections[0]?.id ?? "";
  const sectionIds = useMemo(
    () => uniqueSections.map((section) => section.id),
    [uniqueSections],
  );
  const locationHash = useSyncExternalStore(
    subscribeToLocationHash,
    readLocationHash,
    readServerLocationHash,
  );
  const activeSectionId = fallbackSectionId
    ? initialSectionFromHash(sectionIds, fallbackSectionId, locationHash)
    : "";

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
        className="dashboard-nav-track scroll-fade-x scroll-fade-x-sm-hide lane-rail flex max-w-full items-center gap-2 overflow-x-auto pb-[0.12rem] sm:flex-wrap sm:overflow-visible sm:pb-0"
      >
        {uniqueSections.map((section) => {
          const isActive = activeSectionId === section.id;
          return (
            <li key={section.id} className="list-none shrink-0 sm:shrink">
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                data-active={isActive ? "true" : "false"}
                data-scroll-target="true"
                className={cn(
                  "focus-ring neon-chip inline-flex min-h-10 items-center rounded-full px-3 py-1.5 text-xs font-semibold",
                  isActive ? "neon-chip-info" : "neon-chip-muted",
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function subscribeToLocationHash(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);
  return () => {
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function readLocationHash(): string {
  return window.location.hash;
}

function readServerLocationHash(): string {
  return "";
}
