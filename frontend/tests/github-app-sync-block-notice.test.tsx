import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";

describe("GitHubAppSyncBlockNotice", () => {
  it("announces sync-block message in a polite status region while keeping actions interactive", () => {
    render(<GitHubAppSyncBlockNotice message="GitHub App installation is required for this account." />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("GitHub App installation is required for this account.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Install GitHub App" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open sync settings" })).toBeTruthy();
  });

  it("can hide settings shortcut when already rendered inside settings flows", () => {
    render(
      <GitHubAppSyncBlockNotice
        message="GitHub App installation is required for this account."
        showSettingsLink={false}
      />,
    );

    expect(screen.getByRole("link", { name: "Install GitHub App" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open sync settings" })).toBeNull();
  });
});
