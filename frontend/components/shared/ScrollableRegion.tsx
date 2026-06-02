import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ScrollableRegionLabelProps =
  | {
      label: string;
      labelledById?: never;
    }
  | {
      label?: never;
      labelledById: string;
    };

type ScrollableRegionProps = ScrollableRegionLabelProps &
  Omit<ComponentPropsWithoutRef<"div">, "role" | "tabIndex" | "aria-label" | "aria-labelledby"> & {
    children: ReactNode;
    focusable?: boolean;
  };

export function ScrollableRegion({
  label,
  labelledById,
  focusable = true,
  className,
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}: ScrollableRegionProps) {
  const descriptionId = useId();
  const describedBy = [
    ariaDescribedBy,
    focusable ? descriptionId : undefined,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <div
      role="region"
      aria-label={label}
      aria-labelledby={labelledById}
      aria-describedby={describedBy}
      tabIndex={focusable ? 0 : undefined}
      className={cn(focusable ? "focus-ring" : "", className)}
      {...props}
    >
      {focusable ? (
        <span id={descriptionId} className="sr-only">
          Scrollable region. Use keyboard arrow keys, touch, or pointer scrolling to review hidden content.
        </span>
      ) : null}
      {children}
    </div>
  );
}
