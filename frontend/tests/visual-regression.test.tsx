import React, { type ReactNode } from "react";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPageClient } from "@/features/dashboard/components/DashboardPageClient";
import { LeaderboardPageClient } from "@/features/leaderboard/components/LeaderboardPageClient";
import {
  abraInsightsFixture,
  leaderboardFixture,
  privateProfileFixture,
  questFixture,
  renderWithClient,
} from "@/tests/helpers/live-fixtures";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string;
    src: string;
  }) => React.createElement("img", { alt, src }),
}));

vi.mock("@/components/shared/SkillRadarChart", () => ({
  SkillRadarChart: () => <div>Live skill radar fixture rendered</div>,
}));

vi.mock("@/components/shared/TimelineChart", () => ({
  TimelineChart: () => <div>Live timeline fixture rendered</div>,
}));

describe("route-level visual regression snapshots", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(visualFixtureFetch));
  });

  it("matches dashboard visual shell snapshot", async () => {
    const rendered = renderWithClient(<DashboardPageClient />);
    await screen.findByText("Live Fixture Maintainer");
    expect(normalizeSnapshotHTML(rendered.container.innerHTML)).toMatchSnapshot();
  });

  it("matches leaderboard visual shell snapshot", async () => {
    const rendered = renderWithClient(<LeaderboardPageClient />);
    await screen.findByText("Live Leaderboard Maintainer");
    expect(normalizeSnapshotHTML(rendered.container.innerHTML)).toMatchSnapshot();
  });
});

async function visualFixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const path = requestPath(input);

  if (path === "/api/profile/me") {
    return jsonResponse(privateProfileFixture);
  }
  if (path === "/api/profile/me/quests") {
    return jsonResponse(questFixture);
  }
  if (path === "/api/leaderboard") {
    return jsonResponse(leaderboardFixture);
  }
  if (path === "/api/ai/abra-insights") {
    return jsonResponse(abraInsightsFixture);
  }
  if (path === "/api/analytics/events") {
    return jsonResponse({ status: "accepted" }, 202);
  }

  return jsonResponse({ error: { message: `Unhandled visual fixture route: ${path}` } }, 404);
}

function requestPath(input: RequestInfo | URL): string {
  const rawURL =
    typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;
  return new URL(rawURL, "http://gitrank.test").pathname;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function normalizeSnapshotHTML(value: string): string {
  return value
    .replace(/id="radix-[^"]*"/g, 'id="radix-id"')
    .replace(/aria-controls="radix-[^"]*"/g, 'aria-controls="radix-controls"')
    .replace(/aria-labelledby="radix-[^"]*"/g, 'aria-labelledby="radix-labelledby"')
    .replace(/\s+/g, " ")
    .trim();
}
