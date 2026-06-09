import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsRepositoryVisibilitySection } from "@/features/settings/components/SettingsRepositoryVisibilitySection";

describe("SettingsRepositoryVisibilitySection", () => {
  it("renders a singular repository summary", () => {
    render(
      <SettingsRepositoryVisibilitySection
        repositories={[
          {
            name: "octo/gitrank",
            tracked: true,
            visibility: "Public",
            reason: "Visible on the public profile.",
          },
        ]}
        pendingRepository={null}
        onRepositoryVisibilityChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Repository visibility" })).toBeTruthy();
    expect(screen.getByText("1 repository")).toBeTruthy();
    expect(screen.queryByText("1 repositories")).toBeNull();
  });
});
