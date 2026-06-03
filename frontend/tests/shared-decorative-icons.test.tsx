import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { Activity } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";
import { RankBadge } from "@/components/shared/RankBadge";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import { StatCard } from "@/components/shared/StatCard";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("shared decorative icons", () => {
  it("keeps summary and status icons out of the accessible name", () => {
    const rendered = render(
      <div>
        <RankBadge rank="Gold III" />
        <SnapshotFreshnessPill refreshedAt="2026-05-25T10:30:00.000Z" />
        <SyncStatusPill
          status={{
            state: "synced",
            lastSyncedAt: "2026-05-25T10:30:00.000Z",
            progress: 100,
            partialProfileAvailable: false,
          }}
        />
        <GitHubAppSyncBlockNotice />
        <StatCard label="Merged PRs" value={12} icon={<Activity />} />
      </div>,
    );

    const icons = rendered.container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
