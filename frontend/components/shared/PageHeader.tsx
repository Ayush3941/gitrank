import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow = "Signal Board",
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("cyber-header cyber-frame flex flex-col gap-4 rounded-[1.85rem] px-5 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-2">
        <p className="text-xs font-medium text-primary">{eyebrow}</p>
        <h1 className="neon-title cyber-title break-anywhere text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="cyber-copy-muted readable-measure break-anywhere max-w-[72ch] text-sm leading-7 sm:text-base">{description}</p>
        <div className="cyber-divider max-w-3xl" />
      </div>
      {actions}
    </header>
  );
}
