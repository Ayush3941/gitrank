import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
};

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  function NativeSelect({ className, wrapperClassName, children, ...props }, ref) {
    return (
      <span className={cn("relative block w-full", wrapperClassName)}>
        <select
          ref={ref}
          className={cn(
            "focus-ring neon-surface h-11 w-full appearance-none rounded-2xl border-primary/28 px-4 pr-11 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60 [&>option]:bg-slate-950 [&>option]:text-white",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          focusable="false"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/80"
        />
      </span>
    );
  },
);
