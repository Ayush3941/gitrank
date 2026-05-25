import React, { type ReactNode } from "react";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPageClient } from "@/features/dashboard/components/DashboardPageClient";
import { LeaderboardPageClient } from "@/features/leaderboard/components/LeaderboardPageClient";
import { PublicProfilePageClient } from "@/features/profile/components/PublicProfilePageClient";
import {
  abraInsightsFixture,
  leaderboardFixture,
  privateProfileFixture,
  publicProfileFixture,
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard/leaderboard",
  useSearchParams: () => new URLSearchParams("lane=global"),
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
    expect(buildDashboardVisualSummary(rendered.container)).toMatchSnapshot();
  });

  it("matches leaderboard visual shell snapshot", async () => {
    const rendered = renderWithClient(<LeaderboardPageClient />);
    await screen.findByText("Live Leaderboard Maintainer", undefined, {
      timeout: 15_000,
    });
    expect(buildLeaderboardVisualSummary(rendered.container)).toMatchSnapshot();
  });

  it("matches public profile visual shell snapshot", async () => {
    const rendered = renderWithClient(
      <PublicProfilePageClient username="live-maintainer" />,
    );
    await screen.findByText("Live Fixture Maintainer");
    expect(buildPublicProfileVisualSummary(rendered.container)).toMatchSnapshot();
  });
});

async function visualFixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const path = requestPath(input);

  if (path === "/api/profile/me") {
    return jsonResponse(privateProfileFixture);
  }
  if (path === "/api/profile/public/live-maintainer") {
    return jsonResponse(publicProfileFixture);
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

function buildDashboardVisualSummary(container: HTMLElement) {
  const root = container.firstElementChild;
  return {
    route: "dashboard",
    heading: text(container, "h1"),
    sectionCount: container.querySelectorAll("section").length,
    metaChips: texts(container, "header ul[role='list'] li span"),
    ctas: texts(container, "header a, section a"),
    heroTitle: text(container, ".player-card-shell p.text-2xl"),
    heroMetricLabels: texts(
      container,
      ".player-card-shell .neon-metric p.text-xs",
    ),
    hasQuestLane: container.textContent?.includes("Loading quests") ?? false,
    hasReportLane: container.textContent?.includes("Loading reports") ?? false,
    rootClassName: root?.className ?? "",
  };
}

function buildLeaderboardVisualSummary(container: HTMLElement) {
  const root = container.firstElementChild;
  return {
    route: "leaderboard",
    heading: text(container, "h1"),
    sectionCount: container.querySelectorAll("section").length,
    laneTabs: texts(container, "[role='tablist'] [role='tab'] .truncate"),
    laneMeta: texts(container, "header ul[role='list'] li span"),
    ctas: texts(container, "header a, section a"),
    hasLeaderboardArena: Boolean(
      container.querySelector("[id='leaderboard-rows-region']"),
    ),
    rootClassName: root?.className ?? "",
  };
}

function buildPublicProfileVisualSummary(container: HTMLElement) {
  const root = container.firstElementChild;
  return {
    route: "public-profile",
    heading: text(container, ".player-card-shell h2"),
    sectionCount: container.querySelectorAll("section").length,
    topSkillChips: texts(container, ".player-card-shell .neon-chip"),
    statCards: texts(
      container,
      ".md\\:grid-cols-2.xl\\:grid-cols-4 .text-sm",
    ),
    repoLabels: texts(
      container,
      "section[aria-label='Timeline and repositories'] li p.break-anywhere.font-medium",
    ),
    hasTimeline: container.textContent?.includes("XP timeline") ?? false,
    rootClassName: root?.className ?? "",
  };
}

function text(container: HTMLElement, selector: string): string {
  const node = container.querySelector<HTMLElement>(selector);
  return normalizeText(node?.textContent ?? "");
}

function texts(container: HTMLElement, selector: string): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector))
    .map((node) => normalizeText(node.textContent ?? ""))
    .filter((value) => value.length > 0)
    .slice(0, 12);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
