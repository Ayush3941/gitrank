"use client";

import { GlowCard } from "@/components/shared/GlowCard";
import { Switch } from "@/components/ui/switch";
import type { PrivacySettings } from "@/types/gitrank";

export type SettingsPublicProfilePrivacyKey =
  | "publicProfileEnabled"
  | "showExactPRs"
  | "showAiSummaries"
  | "showLeaderboardParticipation";

const PUBLIC_PROFILE_ROWS: Array<{
  key: SettingsPublicProfilePrivacyKey;
  label: string;
}> = [
  { key: "publicProfileEnabled", label: "Enable public profile" },
  { key: "showExactPRs", label: "Show exact PRs" },
  { key: "showAiSummaries", label: "Show AI summaries" },
  { key: "showLeaderboardParticipation", label: "Show leaderboard participation" },
];

export function SettingsPublicProfileCard({
  privacy,
  isSaving,
  disabled,
  errorMessage,
  onPrivacyChange,
}: {
  privacy: PrivacySettings;
  isSaving: boolean;
  disabled: boolean;
  errorMessage: string;
  onPrivacyChange: (key: SettingsPublicProfilePrivacyKey, checked: boolean) => void;
}) {
  const errorId = "public-profile-error";

  return (
    <GlowCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Public profile</h2>
        {isSaving ? <p className="text-sm text-primary">Saving...</p> : null}
      </div>
      {errorMessage ? (
        <p
          id={errorId}
          role="alert"
          aria-atomic="true"
          className="text-sm text-rose-200"
        >
          {errorMessage}
        </p>
      ) : null}
      <ul className="space-y-3">
        {PUBLIC_PROFILE_ROWS.map((row, index) => {
          const controlId = `public-profile-${toControlID(row.label)}-${index}`;
          return (
            <li
              key={row.key}
              className="list-none neon-surface flex items-center justify-between gap-4 rounded-[var(--radius-universal)] px-4 py-4"
            >
              <label className="text-sm text-muted" htmlFor={controlId}>
                {row.label}
              </label>
              <Switch
                id={controlId}
                checked={privacy[row.key]}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  onPrivacyChange(row.key, checked);
                }}
                aria-invalid={errorMessage ? true : undefined}
                aria-describedby={errorMessage ? errorId : undefined}
              />
            </li>
          );
        })}
      </ul>
    </GlowCard>
  );
}

function toControlID(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
