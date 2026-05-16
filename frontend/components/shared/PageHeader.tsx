import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("cyber-header cyber-frame flex flex-col gap-4 rounded-[1.85rem] px-5 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-2">
        <p className="cyber-readout text-[11px] text-primary/88">Signal Board</p>
        <h1 className="neon-title cyber-title text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="cyber-copy-muted max-w-3xl text-sm sm:text-base">{description}</p>
        <div className="cyber-divider max-w-3xl" />
      </div>
      {actions}
    </header>
  );
}
