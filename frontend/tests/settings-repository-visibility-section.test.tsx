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

  it("renders plural-aware hidden repository counts", () => {
    const { rerender } = render(
      <SettingsRepositoryVisibilitySection
        repositories={[
          {
            name: "octo/gitrank",
            tracked: true,
            visibility: "Public",
            reason: "Visible on the public profile.",
          },
          {
            name: "octo/private-gitrank",
            tracked: true,
            visibility: "Hidden",
            reason: "Hidden from the public profile.",
          },
        ]}
        pendingRepository={null}
        onRepositoryVisibilityChange={vi.fn()}
      />,
    );

    expect(screen.getByText("2 repositories · 1 hidden repository")).toBeTruthy();

    rerender(
      <SettingsRepositoryVisibilitySection
        repositories={[
          {
            name: "octo/gitrank",
            tracked: true,
            visibility: "Public",
            reason: "Visible on the public profile.",
          },
          {
            name: "octo/private-gitrank",
            tracked: true,
            visibility: "Hidden",
            reason: "Hidden from the public profile.",
          },
          {
            name: "octo/internal-gitrank",
            tracked: false,
            visibility: "Hidden",
            reason: "Hidden from the public profile.",
          },
        ]}
        pendingRepository={null}
        onRepositoryVisibilityChange={vi.fn()}
      />,
    );

    expect(screen.getByText("3 repositories · 2 hidden repositories")).toBeTruthy();
    expect(screen.queryByText("2 hidden")).toBeNull();
  });
});
