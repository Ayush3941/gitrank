import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/6 px-4 text-sm text-foreground placeholder:text-muted/80",
        className,
      )}
      {...props}
    />
  );
}
