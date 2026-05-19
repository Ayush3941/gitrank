import { CopyLinkButton } from "@/components/shared/CopyLinkButton";

type SectionJumpNavItem = {
  id: string;
  label: string;
};

export function SectionJumpNav({
  navLabelID,
  activeSectionLabel,
  items,
  activeSection,
  onSectionSelect,
  copyHref,
  copyAnalyticsTarget,
  className,
  stickyClassName,
}: {
  navLabelID: string;
  activeSectionLabel: string;
  items: SectionJumpNavItem[];
  activeSection: string;
  onSectionSelect: (sectionID: string) => void;
  copyHref: string;
  copyAnalyticsTarget: string;
  className?: string;
  stickyClassName?: string;
}) {
  const stickyClasses = stickyClassName ?? "xl:sticky xl:top-20 xl:z-20";
  return (
    <nav
      aria-labelledby={navLabelID}
      className={`glass-panel flex items-center gap-2 border border-primary/20 p-2 ${stickyClasses} ${className ?? ""}`}
    >
      <p
        id={navLabelID}
        className="hidden shrink-0 px-2 text-xs font-medium text-cyan-100 sm:block"
      >
        Jump to
      </p>
      <p
        role="status"
        aria-live="polite"
        className="hidden shrink-0 px-2 text-sm font-medium text-cyan-100 sm:block"
      >
        {activeSectionLabel}
      </p>
      <div className="min-w-0 flex-1 sm:hidden">
        <label htmlFor={`${navLabelID}-select`} className="sr-only">
          Jump to section
        </label>
        <select
          id={`${navLabelID}-select`}
          value={activeSection}
          onChange={(event) => {
            const sectionID = event.target.value;
            onSectionSelect(sectionID);
            if (typeof window !== "undefined") {
              window.location.hash = sectionID;
            }
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
        <ul role="list" className="flex w-max min-w-full flex-nowrap gap-2">
          {items.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={() => {
                  onSectionSelect(section.id);
                }}
                aria-current={activeSection === section.id ? "location" : undefined}
                className={
                  activeSection === section.id
                    ? "focus-ring border border-primary/45 bg-primary/16 px-3 py-2 text-xs font-semibold text-white"
                    : "focus-ring border border-transparent px-3 py-2 text-xs text-slate-100 hover:border-primary/28 hover:bg-primary/10"
                }
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="shrink-0">
        <CopyLinkButton
          href={copyHref}
          label="Copy section link"
          copiedLabel="Section link copied"
          analyticsTarget={copyAnalyticsTarget}
        />
      </div>
    </nav>
  );
}
