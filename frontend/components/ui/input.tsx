import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "focus-ring neon-surface h-11 w-full rounded-[var(--radius-universal)] border-primary/28 px-4 text-sm text-foreground placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
});
