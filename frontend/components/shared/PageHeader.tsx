import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const showEyebrow =
    typeof eyebrow === "string" &&
    normalizeHeaderToken(eyebrow) !== normalizeHeaderToken(title);

  return (
    <header className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-2">
        {showEyebrow ? <p className="text-xs font-medium text-primary">{eyebrow}</p> : null}
        <h1 className="cyber-title break-anywhere text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="cyber-copy-muted readable-measure break-anywhere max-w-[54ch] text-sm leading-7 sm:text-base">{description}</p>
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

function normalizeHeaderToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
