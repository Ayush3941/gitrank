import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPublicProfileCard } from "@/features/settings/components/SettingsPublicProfileCard";
import { buildPrivacy } from "@/tests/helpers/gitrank-fixtures";

describe("SettingsPublicProfileCard", () => {
  it("uses durable privacy-control ids instead of array-position ids", () => {
    render(
      <SettingsPublicProfileCard
        privacy={buildPrivacy()}
        isSaving={false}
        disabled={false}
        errorMessage=""
        onPrivacyChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("switch", { name: "Enable public profile" }).id).toBe(
      "public-profile-enabled",
    );
    expect(screen.getByRole("switch", { name: "Show exact PRs" }).id).toBe(
      "public-profile-exact-prs",
    );
    expect(screen.getByRole("switch", { name: "Show AI summaries" }).id).toBe(
      "public-profile-ai-summaries",
    );
    expect(
      screen.getByRole("switch", { name: "Show leaderboard participation" }).id,
    ).toBe("public-profile-leaderboard-participation");
  });

  it("announces privacy save progress with concise status copy", () => {
    render(
      <SettingsPublicProfileCard
        privacy={buildPrivacy()}
        isSaving
        disabled
        errorMessage=""
        onPrivacyChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("Saving privacy preferences");
    expect(screen.queryByText("Saving...")).toBeNull();
  });
});
