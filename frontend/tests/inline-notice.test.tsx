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
        placeholder="Export status"
        onDismiss={onDismiss}
        dismissLabel="Dismiss export status"
      />,
    );

    expect(screen.getByRole("status").getAttribute("aria-atomic")).toBe("true");
    const dismiss = screen.getByRole("button", { name: "Dismiss export status" });
    expect(dismiss).toBeTruthy();
    expect(dismiss.className).toContain("h-8 w-8");

    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("can announce inline errors assertively without a dismiss action", () => {
    render(
      <InlineNotice
        message="Sync failed."
        placeholder="Sync action error"
        variant="error"
        liveRole="alert"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Sync failed.");
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(alert.getAttribute("aria-atomic")).toBe("true");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
