import type { ComponentPropsWithoutRef, ReactNode } from "react";
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
  ...props
}: ScrollableRegionProps) {
  return (
    <div
      role="region"
      aria-label={label}
      aria-labelledby={labelledById}
      tabIndex={focusable ? 0 : undefined}
      className={cn(focusable ? "focus-ring" : "", className)}
      {...props}
    >
      {children}
    </div>
  );
}
