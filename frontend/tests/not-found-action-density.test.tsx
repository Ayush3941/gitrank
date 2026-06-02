import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardNotFound from "@/app/(app)/dashboard/not-found";
import MarketingRouteNotFound from "@/app/(marketing)/not-found";
import PublicPRReportNotFound from "@/app/(public)/pr/[owner]/[repo]/[number]/not-found";
import PublicProfileNotFound from "@/app/(public)/u/[username]/not-found";
import NotFound from "@/app/not-found";

describe("not-found recovery action density", () => {
  const routes = [
    ["global", NotFound],
    ["dashboard", DashboardNotFound],
    ["marketing", MarketingRouteNotFound],
    ["public PR report", PublicPRReportNotFound],
    ["public profile", PublicProfileNotFound],
  ] as const;

  for (const [label, NotFoundPage] of routes) {
    it(`keeps ${label} fallback choices focused`, () => {
      render(<NotFoundPage />);

      expect(screen.getAllByRole("link")).toHaveLength(2);
    });
  }
});
