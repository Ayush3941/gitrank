import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { handleHorizontalTabKeyDown } from "@/components/shared/tablist-keyboard";

export type SegmentedTabOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
  minWidthClassName?: string;
};

export function SegmentedTablist<T extends string>({
  options,
  value,
  onValueChange,
  ariaLabel,
  ariaDescribedBy,
  ariaControls,
  tabIdPrefix = "segmented-tab",
  className,
}: {
  options: Array<SegmentedTabOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  ariaDescribedBy?: string;
  ariaControls?: string;
  tabIdPrefix?: string;
  className?: string;
}) {
  function focusWithoutScroll(element: HTMLButtonElement) {
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  }

  return (
    <ul
      role="tablist"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={cn(
        "dashboard-nav-track lane-rail flex gap-1.5 overflow-x-auto p-0.5",
        className,
      )}
    >
      {options.map((item) => {
        const active = value === item.value;
        const tabID = `${tabIdPrefix}-${item.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        return (
          <li
            key={item.value}
            role="presentation"
            className={cn("list-none shrink-0", item.minWidthClassName ?? "min-w-[8rem]")}
          >
            <button
              type="button"
              id={tabID}
              role="tab"
              title={item.label}
              aria-label={item.label}
              aria-controls={ariaControls}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              data-active={active ? "true" : "false"}
              className="focus-ring dashboard-nav-item min-h-11 w-full px-3 py-2 text-center text-sm font-semibold"
              onMouseDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                event.preventDefault();
                focusWithoutScroll(event.currentTarget);
              }}
              onClick={(event) => {
                focusWithoutScroll(event.currentTarget);
                onValueChange(item.value);
              }}
              onKeyDown={handleHorizontalTabKeyDown}
            >
              <span className="inline-flex items-center gap-2">
                {item.icon ? (
                  <span aria-hidden="true" className="dashboard-nav-icon h-4 w-4">
                    {item.icon}
                  </span>
                ) : null}
                <span className="truncate">{item.label}</span>
                {typeof item.count === "number" ? (
                  <span className="rounded-full border border-primary/22 bg-primary/10 px-1.5 py-0.5 text-[11px] leading-none text-primary">
                    {item.count}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
