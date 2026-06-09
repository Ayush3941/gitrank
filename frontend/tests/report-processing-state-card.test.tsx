import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportProcessingStateCard } from "@/features/pr-report/components/ReportProcessingStateCard";

const guidance = {
  tone: "warning" as const,
  label: "Rate limited",
  message: "AI enrichment is temporarily rate limited.",
  cta: "Open settings",
  href: "/dashboard/settings",
};

describe("ReportProcessingStateCard", () => {
  it("marks AI summary retry as busy with concise pending copy", () => {
    render(
      <ReportProcessingStateCard
        guidance={guidance}
        canRetryAiSummary
        isRetrying
        retryNotice={null}
        onRetryAiSummary={vi.fn()}
        onDismissRetryNotice={vi.fn()}
      />,
    );

    const retry = screen.getByRole("button", { name: "Retrying AI summary" });
    expect(retry.getAttribute("aria-busy")).toBe("true");
  });
});
