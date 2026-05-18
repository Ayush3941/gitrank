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
        className="cyber-title shrink-0 px-2 text-[10px] tracking-[0.16em] text-cyan-200 uppercase"
      >
        Jump to
      </p>
      <p
        role="status"
        aria-live="polite"
        className="shrink-0 px-2 text-xs tracking-[0.16em] text-cyan-200 uppercase"
      >
        {activeSectionLabel}
      </p>
      <div className="scrollbar-thin min-w-0 flex-1 overflow-x-auto">
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
                    ? "focus-ring cyber-title border border-primary/45 bg-primary/16 px-3 py-1.5 text-[11px] tracking-[0.16em] text-white uppercase"
                    : "focus-ring cyber-title border border-transparent px-3 py-1.5 text-[11px] tracking-[0.16em] text-slate-200 uppercase hover:border-primary/28 hover:bg-primary/10"
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
