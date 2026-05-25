import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  handleHorizontalTabKeyDown,
  type TablistKeyboardActivation,
} from "@/components/shared/tablist-keyboard";
import { focusWithoutScroll } from "@/components/shared/focus-without-scroll";

export type SegmentedTabOption<T extends string> = {
  value: T;
  label: string;
  compactLabel?: string;
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
  wrap = false,
  keyboardActivation = "manual",
}: {
  options: Array<SegmentedTabOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  ariaDescribedBy?: string;
  ariaControls?: string;
  tabIdPrefix?: string;
  className?: string;
  wrap?: boolean;
  keyboardActivation?: TablistKeyboardActivation;
}) {
  function handleSelect(nextValue: T) {
    if (nextValue === value) {
      return;
    }
    onValueChange(nextValue);
  }

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      data-segmented-tablist="true"
      className={cn(
        wrap
          ? "dashboard-nav-track lane-rail flex flex-wrap gap-1.5 overflow-visible p-0.5"
          : "dashboard-nav-track lane-rail flex gap-1.5 overflow-x-auto p-0.5",
        className,
      )}
    >
      <ul role="list" className="contents">
        {options.map((item) => {
          const active = value === item.value;
          const optionID = `${tabIdPrefix}-${item.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          const accessibleLabel = item.compactLabel
            ? `${item.compactLabel} (${item.label})`
            : item.label;
          return (
            <li
              key={item.value}
              className={cn("list-none shrink-0", item.minWidthClassName ?? "min-w-[8rem]")}
            >
              <button
                type="button"
                role="tab"
                id={optionID}
                title={item.label}
                aria-label={accessibleLabel}
                aria-controls={ariaControls}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                data-active={active ? "true" : "false"}
                data-segmented-option="true"
                data-segmented-value={item.value}
                className="focus-ring dashboard-nav-item min-h-11 w-full px-3 py-2 text-center text-sm font-semibold"
                onMouseDown={(event) => {
                  if (event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  focusWithoutScroll(event.currentTarget);
                }}
                onClick={() => {
                  handleSelect(item.value);
                }}
                onKeyDown={(event) => {
                  handleHorizontalTabKeyDown(event, {
                    activationMode: keyboardActivation,
                    onActivate: (target) => {
                      const nextValue = target.getAttribute("data-segmented-value");
                      if (!nextValue) {
                        return;
                      }
                      handleSelect(nextValue as T);
                    },
                  });
                }}
              >
                <span className="inline-flex items-center gap-2">
                  {item.icon ? (
                    <span aria-hidden="true" className="dashboard-nav-icon h-4 w-4">
                      {item.icon}
                    </span>
                  ) : null}
                  {item.compactLabel ? (
                    <>
                      <span className="truncate sm:hidden">{item.compactLabel}</span>
                      <span className="hidden truncate sm:inline">{item.label}</span>
                    </>
                  ) : (
                    <span className="truncate">{item.label}</span>
                  )}
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
    </div>
  );
}
