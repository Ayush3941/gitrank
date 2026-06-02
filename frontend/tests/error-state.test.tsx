import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "@/components/shared/ErrorState";

describe("ErrorState", () => {
  it("limits the assertive alert to error copy and keeps retry controls outside it", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="Sync failed"
        description="GitHub did not respond in time."
        fallbackHref=""
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole("alert");
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(alert.textContent).toContain("Sync failed");
    expect(alert.textContent).toContain("GitHub did not respond in time.");
    expect(alert.contains(retry)).toBe(false);

    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
