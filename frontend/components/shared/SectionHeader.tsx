import type { ReactNode } from "react";
import { shouldShowHeaderEyebrow } from "@/lib/presentation/header-eyebrow";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const showEyebrow = shouldShowHeaderEyebrow(eyebrow, title);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="space-y-2">
        {showEyebrow ? (
          <p className="hud-eyebrow text-xs font-semibold">{eyebrow}</p>
        ) : null}
        <h2 className="cyber-title text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="cyber-copy-muted readable-measure max-w-[68ch] text-sm leading-7 section-subtitle">{description}</p>
      </div>
      {action ? <div className="sm:pt-1">{action}</div> : null}
    </div>
  );
}
