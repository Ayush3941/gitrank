"use client";

import { useEffect, useRef } from "react";

type SectionJumpNavItem<SectionID extends string = string> = {
  id: SectionID;
  label: string;
};

export function SectionJumpNav<SectionID extends string>({
  navLabelID,
  landmarkLabel,
  activeSectionLabel,
  items,
  activeSection,
  onSectionSelect,
  className,
  stickyClassName,
}: {
  navLabelID: string;
  landmarkLabel?: string;
  activeSectionLabel: string;
  items: readonly SectionJumpNavItem<SectionID>[];
  activeSection: SectionID;
  onSectionSelect: (sectionID: SectionID) => void;
  copyHref?: string;
  copyAnalyticsTarget?: string;
  className?: string;
  stickyClassName?: string;
}) {
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const railRef = useRef<HTMLUListElement | null>(null);
  const stickyClasses = stickyClassName ?? "";

  useEffect(() => {
    const activeItem = itemRefs.current[activeSection];
    const railNode = railRef.current;
    if (!activeItem || !railNode || typeof window === "undefined") {
      return;
    }
    const itemStart = activeItem.offsetLeft;
    const itemEnd = itemStart + activeItem.offsetWidth;
    const viewStart = railNode.scrollLeft;
    const viewEnd = viewStart + railNode.clientWidth;
    const itemAlreadyVisible = itemStart >= viewStart && itemEnd <= viewEnd;
    if (itemAlreadyVisible) {
      return;
    }
    const centeredLeft = Math.max(
      0,
      itemStart - (railNode.clientWidth - activeItem.offsetWidth) / 2,
    );
    railNode.scrollTo({
      left: centeredLeft,
      behavior: "auto",
    });
  }, [activeSection]);

  function focusSection(sectionID: SectionID) {
    onSectionSelect(sectionID);
    if (typeof window === "undefined") {
      return;
    }
    const node = document.getElementById(sectionID);
    if (!node || typeof node.scrollIntoView !== "function") {
      return;
    }
    node.scrollIntoView({
      block: "start",
      behavior: "auto",
    });
  }

  return (
    <nav
      aria-label={landmarkLabel ?? "Section navigation"}
      className={`neon-surface flex flex-col gap-2 border border-primary/20 p-1.5 sm:flex-row sm:items-center ${stickyClasses} ${className ?? ""}`}
    >
      <div className="min-w-0 flex-1 sm:hidden">
        <p className="mb-1 px-1 text-xs font-medium text-cyan-100">
          {activeSectionLabel}
        </p>
        <label htmlFor={`${navLabelID}-select`} className="sr-only">
          Jump to section
        </label>
        <select
          id={`${navLabelID}-select`}
          value={activeSection}
          onChange={(event) => {
            const sectionID = event.target.value as SectionID;
            focusSection(sectionID);
          }}
          className="focus-ring w-full border border-primary/28 bg-primary/8 px-3 py-2 text-sm text-white"
        >
          {items.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </div>
      <div className="scrollbar-thin hidden min-w-0 flex-1 overflow-x-auto sm:block">
        <ul ref={railRef} role="list" className="flex w-max min-w-full flex-nowrap gap-2 overflow-x-auto">
          {items.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                ref={(node) => {
                  itemRefs.current[section.id] = node;
                }}
                onClick={() => {
                  focusSection(section.id);
                }}
                aria-current={activeSection === section.id ? "location" : undefined}
                className={
                  activeSection === section.id
                    ? "focus-ring inline-flex min-h-9 items-center border border-primary/45 bg-primary/16 px-3 py-2 text-xs font-semibold text-white"
                    : "focus-ring inline-flex min-h-9 items-center border border-transparent px-3 py-2 text-xs text-foreground hover:border-primary/28 hover:bg-primary/10"
                }
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
