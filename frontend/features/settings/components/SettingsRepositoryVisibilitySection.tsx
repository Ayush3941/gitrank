"use client";

import dynamic from "next/dynamic";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import type { RepositoryVisibility } from "@/types/gitrank";

const PrivacyRepositoryToggleList = dynamic(
  () =>
    import("@/features/settings/components/PrivacyRepositoryToggleList").then(
      (mod) => mod.PrivacyRepositoryToggleList,
    ),
  {
    loading: () => <SettingsPanelPlaceholder label="Loading repository visibility controls" />,
  },
);

export function SettingsRepositoryVisibilitySection({
  repositories,
  pendingRepository,
  onRepositoryVisibilityChange,
}: {
  repositories: RepositoryVisibility[];
  pendingRepository: string | null;
  onRepositoryVisibilityChange: (
    repository: RepositoryVisibility,
    checked: boolean,
  ) => void;
}) {
  const hiddenRepositoryCount = repositories.filter(
    (repository) => repository.visibility !== "Public",
  ).length;

  return (
    <DeferUntilVisible fallback={<SettingsPanelPlaceholder label="Loading repository controls" />}>
      <GlowCard className="space-y-4">
        <div>
          <p className="text-xs font-medium text-primary">Repository privacy</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Repository visibility</h2>
        </div>
        <p className="text-sm text-muted">
          {repositories.length} repositories
          {hiddenRepositoryCount > 0 ? ` \u00b7 ${hiddenRepositoryCount} hidden` : ""}
        </p>
        <PrivacyRepositoryToggleList
          repositories={repositories}
          pendingRepository={pendingRepository}
          onToggle={onRepositoryVisibilityChange}
        />
      </GlowCard>
    </DeferUntilVisible>
  );
}

function SettingsPanelPlaceholder({ label }: { label: string }) {
  return (
    <PanelLoadingPlaceholder
      label={label}
      surface="plain"
      skeletons={[
        { className: "h-9 w-1/2" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
