import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring h-11 w-full rounded-2xl border border-primary/24 bg-background/60 px-4 text-sm text-foreground placeholder:text-muted/80",
        className,
      )}
      {...props}
    />
  );
}
