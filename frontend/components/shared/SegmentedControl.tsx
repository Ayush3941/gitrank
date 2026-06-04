import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { handleSegmentedControlKeyDown } from "@/components/shared/segmented-control-keyboard";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  compactLabel?: string;
  icon?: ReactNode;
  count?: number;
  minWidthClassName?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  ariaLabel,
  ariaDescribedBy,
  ariaControls,
  controlIdPrefix = "segmented-control",
  className,
  wrap = false,
}: {
  options: Array<SegmentedControlOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  ariaDescribedBy?: string;
  ariaControls?: string;
  controlIdPrefix?: string;
  className?: string;
  wrap?: boolean;
}) {
  function handleSelect(nextValue: T) {
    if (nextValue === value) {
      return;
    }
    onValueChange(nextValue);
  }

  return (
    <div
      role="radiogroup"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      data-segmented-control="true"
      className={cn(
        wrap
          ? "dashboard-nav-track lane-rail flex flex-wrap gap-2 overflow-visible p-0.5"
          : "dashboard-nav-track scroll-fade-x scroll-fade-x-sm-hide lane-rail flex gap-2 overflow-x-auto p-0.5",
        className,
      )}
    >
      <ul role="presentation" className="contents">
        {options.map((item) => {
          const active = value === item.value;
          const optionID = `${controlIdPrefix}-${item.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          const hasDistinctCompactLabel =
            typeof item.compactLabel === "string" &&
            item.compactLabel.trim().length > 0 &&
            item.compactLabel !== item.label;
          return (
            <li
              key={item.value}
              role="none"
              className={cn("list-none shrink-0", item.minWidthClassName ?? "min-w-[8rem]")}
            >
              <button
                type="button"
                role="radio"
                id={optionID}
                aria-label={item.label}
                aria-controls={ariaControls}
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                data-active={active ? "true" : "false"}
                data-segmented-option="true"
                data-segmented-value={item.value}
                className="focus-ring dashboard-nav-item min-h-11 w-full px-3 py-2 text-center text-sm font-semibold"
                onClick={() => {
                  handleSelect(item.value);
                }}
                onKeyDown={(event) => {
                  handleSegmentedControlKeyDown(event, {
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
                  {hasDistinctCompactLabel ? (
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
