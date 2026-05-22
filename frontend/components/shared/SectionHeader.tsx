import type { ReactNode } from "react";

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
  const showEyebrow =
    typeof eyebrow === "string" &&
    normalizeHeaderToken(eyebrow) !== normalizeHeaderToken(title);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {showEyebrow ? (
          <p className="hud-eyebrow text-xs font-semibold">{eyebrow}</p>
        ) : null}
        <h2 className="cyber-title text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="cyber-copy-muted readable-measure max-w-[68ch] text-sm leading-7 section-subtitle">{description}</p>
      </div>
      {action}
    </div>
  );
}

function normalizeHeaderToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
