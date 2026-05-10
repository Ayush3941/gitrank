"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import type { RepositoryVisibility } from "@/types/gitrank";

export function PrivacyRepositoryToggleList({
  repositories,
  onToggle,
  pendingRepository,
}: {
  repositories: RepositoryVisibility[];
  onToggle?: (repository: RepositoryVisibility, checked: boolean) => void;
  pendingRepository?: string | null;
}) {
  const [items, setItems] = useState(repositories);
  const controlled = typeof onToggle === "function";

  const visibleItems = controlled ? repositories : items;

  return (
    <div className="space-y-3">
      {visibleItems.map((repo) => (
        <div key={repo.name} className="flex flex-col gap-3 rounded-[1.75rem] border border-white/8 bg-white/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-white">{repo.name}</p>
            <p className="text-sm text-muted">{repo.reason}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">{repo.visibility}</span>
            <Switch
              checked={repo.visibility === "Public"}
              disabled={pendingRepository === repo.name}
              onCheckedChange={(checked) => {
                if (controlled) {
                  onToggle(repo, checked);
                  return;
                }

                setItems((current) =>
                  current.map((item) =>
                    item.name === repo.name
                      ? { ...item, visibility: checked ? "Public" : "Hidden" }
                      : item,
                  ),
                );
              }}
              aria-label={`Toggle ${repo.name} visibility`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
