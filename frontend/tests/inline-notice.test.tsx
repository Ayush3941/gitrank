import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InlineNotice } from "@/components/shared/InlineNotice";

describe("InlineNotice", () => {
  it("renders placeholder lane when no message is present", () => {
    render(<InlineNotice placeholder="Sync status" />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Sync status")).toBeTruthy();
  });

  it("renders dismiss action and triggers callback", () => {
    const onDismiss = vi.fn();
    render(
      <InlineNotice
        message="Profile export queued"
        onDismiss={onDismiss}
        dismissLabel="Dismiss export status"
      />,
    );

    expect(screen.getByRole("status")).toBeTruthy();
    const dismiss = screen.getByRole("button", { name: "Dismiss export status" });
    expect(dismiss).toBeTruthy();
    expect(dismiss.className).toContain("h-6 w-6");

    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
