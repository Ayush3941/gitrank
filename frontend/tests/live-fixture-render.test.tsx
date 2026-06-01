import React, { type ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPageClient } from "@/features/dashboard/components/DashboardPageClient";
import { BadgesPageClient } from "@/features/badges/components/BadgesPageClient";
import { LeaderboardPageClient } from "@/features/leaderboard/components/LeaderboardPageClient";
import { PRBattleReportPageClient } from "@/features/pr-report/components/PRBattleReportPageClient";
import { PublicProfilePageClient } from "@/features/profile/components/PublicProfilePageClient";
import { QuestsPageClient } from "@/features/quests/components/QuestsPageClient";
import { SettingsPageClient } from "@/features/settings/components/SettingsPageClient";
import {
  abraInsightsFixture,
  accountExportFixture,
  leaderboardFixture,
  prReportFixture,
  privateProfileFixture,
  privateProfileFixtureStale,
  publicProfileFixture,
  questFixture,
  questFixtureStale,
  renderWithClient,
} from "@/tests/helpers/live-fixtures";

const requestedPaths: string[] = [];
let mockedSearchParams = "";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard/leaderboard",
  useSearchParams: () => new URLSearchParams(mockedSearchParams),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string;
    src: string;
    width?: number;
    height?: number;
    className?: string;
  }) => React.createElement("img", { alt, src }),
}));

vi.mock("@/components/shared/SkillRadarChart", () => ({
  SkillRadarChart: () => <div>Live skill radar fixture rendered</div>,
}));

vi.mock("@/components/shared/TimelineChart", () => ({
  TimelineChart: () => <div>Live timeline fixture rendered</div>,
}));

describe("live fixture frontend smoke coverage", () => {
  beforeEach(() => {
    requestedPaths.length = 0;
    mockedSearchParams = "";
    vi.stubGlobal("fetch", vi.fn(liveFixtureFetch));
  });

  it("renders dashboard from profile and quest BFF fixtures", async () => {
    renderWithClient(<DashboardPageClient />);

    await waitFor(() =>
      expect(requestedPaths).toEqual(
        expect.arrayContaining(["/api/profile/me", "/api/profile/me/quests"]),
      ),
    );
    expect(
      await screen.findByText("Live Fixture Maintainer", undefined, {
        timeout: 5000,
      }),
    ).toBeTruthy();
    expect(await screen.findByText("Live Skill Sprint")).toBeTruthy();
    expect(await screen.findByText("Live PR fixture report")).toBeTruthy();
  }, 15_000);

  it("renders quest board from the live quest fixture route", async () => {
    renderWithClient(<QuestsPageClient />);

    expect((await screen.findAllByText("Live Skill Sprint")).length).toBeGreaterThan(0);
    expect(
      await screen.findByText("Backed by live quest fixture evidence."),
    ).toBeTruthy();
    expect(screen.queryByText("Active: 1")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/i }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Weekly/i }).getAttribute("aria-selected")).toBe("true"),
    );
    expect(await screen.findByText("Active: 1")).toBeTruthy();
    const paths = nonAnalyticsPaths();
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/profile/me",
        "/api/profile/me/quests",
        "/api/sync/runs",
      ]),
    );
  }, 15_000);

  it("renders badges view with active-filter count summary when a lane is selected", async () => {
    renderWithClient(<BadgesPageClient />);

    expect(await screen.findByRole("heading", { name: "Badges" })).toBeTruthy();
    expect(screen.queryByText("Active: 1")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Rare/i }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Rare/i }).getAttribute("aria-selected")).toBe("true"),
    );
    expect(await screen.findByText("Active: 1")).toBeTruthy();
    expect(nonAnalyticsPaths()).toEqual(
      expect.arrayContaining(["/api/profile/me", "/api/sync/runs"]),
    );
  }, 15_000);

  it("renders PR battle report from the live PR report fixture route", async () => {
    const rendered = renderWithClient(
      <PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />,
    );

    expect(await screen.findByText("Live PR fixture report")).toBeTruthy();
    expect(
      await screen.findByText(
        "Live bounded diff summary from persisted evidence.",
      ),
    ).toBeTruthy();
    expect(
      (await screen.findAllByText("Backed by live PR report evidence.")).length,
    ).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Show details" }));
    expect(await screen.findByRole("region", { name: /Hide details/i })).toBeTruthy();
    expect(await screen.findByText("Persisted scorer components")).toBeTruthy();
    expect(
      await screen.findByText(
        /Final deterministic XP recorded by the scoring engine(?:\. Source: score_event_metadata\.)?/,
      ),
    ).toBeTruthy();
    expect(rendered.container.querySelectorAll("dl dt").length).toBeGreaterThan(0);
    expect(await screen.findByText("Live Test Builder")).toBeTruthy();
    expect(nonAnalyticsPaths()).toEqual(["/api/pr/octo/gitrank/42/report"]);
  }, 15_000);

  it("renders public profile from the public profile BFF fixture", async () => {
    renderWithClient(<PublicProfilePageClient username="live-maintainer" />);

    expect(await screen.findByText("Live Fixture Maintainer")).toBeTruthy();
    expect(
      await screen.findByText(
        "Live fixture profile rendered through BFF-shaped JSON.",
      ),
    ).toBeTruthy();
    const paths = nonAnalyticsPaths();
    expect(paths).toContain("/api/profile/public/live-maintainer");
    expect(
      paths.every(
        (path) =>
          path === "/api/profile/public/live-maintainer" ||
          path === "/api/ai/abra-insights",
      ),
    ).toBe(true);
  }, 15_000);

  it("renders leaderboard from the live leaderboard fixture route", async () => {
    renderWithClient(<LeaderboardPageClient />);

    expect(
      await screen.findByText("v2-smoke", undefined, { timeout: 15_000 }),
    ).toBeTruthy();
    expect(
      await screen.findByText("Live Leaderboard Maintainer", undefined, {
        timeout: 15_000,
      }),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        "Leaderboard rows are backed by persisted season snapshots and rank movement events.",
        undefined,
        { timeout: 15_000 },
      ),
    ).toBeTruthy();
    expect(await screen.findByText("Lane: Global")).toBeTruthy();
    expect(screen.queryByText(/View: (Nearby|Full board)/)).toBeNull();
    expect(screen.queryByText("Details: On")).toBeNull();
    const showFullBoardButton = screen.queryByRole("button", { name: "Show full board" });
    if (showFullBoardButton) {
      fireEvent.click(showFullBoardButton);
      expect(await screen.findByText("View: Full board")).toBeTruthy();
    }
    expect(nonAnalyticsPaths()).toEqual(
      expect.arrayContaining([
        "/api/leaderboard",
        "/api/profile/me",
        "/api/sync/runs",
      ]),
    );
  }, 15_000);

  it("renders leaderboard with active lane summary when lane query is preset", async () => {
    mockedSearchParams = "lane=backend";
    renderWithClient(<LeaderboardPageClient />);

    expect(await screen.findByText("Lane: Backend")).toBeTruthy();
    expect(await screen.findByText("Active: 1")).toBeTruthy();
    expect(nonAnalyticsPaths()).toEqual(
      expect.arrayContaining([
        "/api/leaderboard",
        "/api/profile/me",
        "/api/sync/runs",
      ]),
    );
  }, 15_000);

  it("renders leaderboard arena preview when no live rows are available", async () => {
    requestedPaths.length = 0;
    vi.stubGlobal("fetch", vi.fn(leaderboardEmptyFixtureFetch));
    renderWithClient(<LeaderboardPageClient />);

    expect(await screen.findByText("No leaderboard rows yet.")).toBeTruthy();
    expect(await screen.findByText("Arena preview")).toBeTruthy();
    expect(
      await screen.findByText(
        "Preview only. These bands explain progression rules and do not represent live user rows.",
      ),
    ).toBeTruthy();
    expect(await screen.findByText("Bronze ladder")).toBeTruthy();
    expect(await screen.findByText("Silver ladder")).toBeTruthy();
    expect(await screen.findByText("Gold+ ladder")).toBeTruthy();
    expect(
      await screen.findByText(/Your current tier:/i),
    ).toBeTruthy();
  }, 15_000);

  it("renders settings from the authenticated profile fixture", async () => {
    renderWithClient(<SettingsPageClient />);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(
      await screen.findByRole("heading", { name: "@live-maintainer" }),
    ).toBeTruthy();
    expect(await screen.findByText("octo/gitrank")).toBeTruthy();
    await waitFor(() =>
      expect(localStorage.getItem("gitrank:reduced-gamification")).toBe("true"),
    );
    fireEvent.click(await screen.findByText("Export data"));
    expect(
      await screen.findByText(
        "Account export generated. Token secrets and secret hashes are excluded from the file.",
      ),
    ).toBeTruthy();
    const paths = nonAnalyticsPaths();
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/profile/me",
        "/api/sync/runs",
        "/api/account/export",
      ]),
    );
  }, 15_000);

  it("renders stale quest state from a stale quest snapshot fixture", async () => {
    requestedPaths.length = 0;
    vi.stubGlobal("fetch", vi.fn(staleQuestFixtureFetch));
    renderWithClient(<QuestsPageClient />);

    expect(await screen.findByText(/Quest snapshot refreshed/i)).toBeTruthy();
    expect(nonAnalyticsPaths()).toEqual(
      expect.arrayContaining([
        "/api/profile/me",
        "/api/profile/me/quests",
        "/api/sync/runs",
      ]),
    );
  }, 15_000);

  it("renders leaderboard error state when the leaderboard BFF route fails", async () => {
    requestedPaths.length = 0;
    vi.stubGlobal("fetch", vi.fn(leaderboardErrorFixtureFetch));
    renderWithClient(<LeaderboardPageClient />);

    expect(await screen.findByText("Leaderboard unavailable")).toBeTruthy();
    expect(await screen.findByText("Open dashboard")).toBeTruthy();
  }, 15_000);

  it("renders stale sync status on settings when profile staleness is true", async () => {
    requestedPaths.length = 0;
    vi.stubGlobal("fetch", vi.fn(staleProfileFixtureFetch));
    renderWithClient(<SettingsPageClient />);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(await screen.findByText("Stale")).toBeTruthy();
  }, 15_000);

  it("surfaces install action when latest sync run reports missing GitHub App installation", async () => {
    requestedPaths.length = 0;
    vi.stubGlobal("fetch", vi.fn(appInstallBlockedSettingsFixtureFetch));
    renderWithClient(<SettingsPageClient />);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Install GitHub App" })).toBeTruthy();
  }, 15_000);
});

function nonAnalyticsPaths(): string[] {
  return requestedPaths.filter((entry) => entry !== "/api/analytics/events");
}

async function liveFixtureFetch(input: RequestInfo | URL): Promise<Response> {
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
  if (path === "/api/pr/octo/gitrank/42/report") {
    return jsonResponse(prReportFixture);
  }
  if (path === "/api/leaderboard") {
    return jsonResponse(leaderboardFixture);
  }
  if (path === "/api/account/export") {
    return jsonResponse(accountExportFixture);
  }
  if (path === "/api/session/me") {
    return jsonResponse(sessionEnvelopeFixture());
  }
  if (path === "/api/profile/schema") {
    return jsonResponse({
      sections: [
        { key: "summary", summary: "Overall rank, XP, strengths, and freshness", status: "implemented" },
      ],
      generated_at: new Date().toISOString(),
    });
  }
  if (path === "/api/meta/manifest") {
    return jsonResponse({
      service: "gitrank-local",
      version: "dev",
      routes: [],
      dependencies: [],
    });
  }
  if (path === "/api/meta/dependencies") {
    return jsonResponse({
      generated_at: new Date().toISOString(),
      dependencies: [],
    });
  }
  if (path === "/api/meta/services") {
    return jsonResponse({
      generated_at: new Date().toISOString(),
      services: [],
    });
  }
  if (path === "/api/sync/runs") {
    return jsonResponse({
      runs: [],
      last_updated_at: new Date().toISOString(),
    });
  }
  if (path === "/api/ai/abra-insights") {
    return jsonResponse(abraInsightsFixture);
  }

  return jsonResponse(
    { error: { message: `Unhandled live fixture route: ${path}` } },
    404,
  );
}

async function staleQuestFixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const path = requestPath(input);
  if (path === "/api/profile/me") {
    return jsonResponse(privateProfileFixtureStale);
  }
  if (path === "/api/profile/me/quests") {
    return jsonResponse(questFixtureStale);
  }
  if (path === "/api/analytics/events") {
    return jsonResponse({ status: "accepted" }, 202);
  }
  return liveFixtureFetch(input);
}

async function leaderboardErrorFixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const path = requestPath(input);
  if (path === "/api/profile/me") {
    return jsonResponse(privateProfileFixture);
  }
  if (path === "/api/leaderboard") {
    return jsonResponse({ error: { message: "upstream timeout" } }, 503);
  }
  if (path === "/api/analytics/events") {
    return jsonResponse({ status: "accepted" }, 202);
  }
  return liveFixtureFetch(input);
}

async function leaderboardEmptyFixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const path = requestPath(input);
  if (path === "/api/profile/me") {
    return jsonResponse(privateProfileFixture);
  }
  if (path === "/api/leaderboard") {
    return jsonResponse({
      ...leaderboardFixture,
      entries: [],
    });
  }
  if (path === "/api/analytics/events") {
    return jsonResponse({ status: "accepted" }, 202);
  }
  return liveFixtureFetch(input);
}

async function staleProfileFixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const path = requestPath(input);
  if (path === "/api/profile/me") {
    return jsonResponse(privateProfileFixtureStale);
  }
  if (path === "/api/account/export") {
    return jsonResponse(accountExportFixture);
  }
  if (path === "/api/analytics/events") {
    return jsonResponse({ status: "accepted" }, 202);
  }
  return liveFixtureFetch(input);
}

async function appInstallBlockedSettingsFixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const path = requestPath(input);
  if (path === "/api/profile/me") {
    return jsonResponse(privateProfileFixtureStale);
  }
  if (path === "/api/sync/runs") {
    return jsonResponse({
      runs: [
        {
          id: "run_install_required",
          run_type: "user",
          status: "failed",
          subject: "@live-maintainer",
          requested_user: "live-maintainer",
          requested_by_github_login: "live-maintainer",
          started_at: "2026-05-31T10:00:00.000Z",
          finished_at: "2026-05-31T10:00:03.000Z",
          metrics: {
            app_installation_required: 1,
          },
          last_error:
            "github app installation is required for user sync; install app and retry",
        },
      ],
      total: 1,
      limit: 12,
      offset: 0,
      last_updated_at: new Date().toISOString(),
    });
  }
  if (path === "/api/analytics/events") {
    return jsonResponse({ status: "accepted" }, 202);
  }
  return liveFixtureFetch(input);
}

function requestPath(input: RequestInfo | URL): string {
  const rawURL =
    typeof input === "string" || input instanceof URL
      ? input.toString()
      : input.url;
  const path = new URL(rawURL, "http://gitrank.test").pathname;
  requestedPaths.push(path);
  return path;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function sessionEnvelopeFixture() {
  const nowISO = new Date().toISOString();
  return {
    session: {
      subject: "11111111-1111-1111-1111-111111111111",
      display_name: "Live Fixture Maintainer",
      github_login: "live-maintainer",
      github_authorization_status: "active",
      session_expires_at: nowISO,
      session_idle_expires_at: nowISO,
      session_rotated_at: nowISO,
      linked_account: {
        github_user_id: 42,
        login: "live-maintainer",
        status: "linked",
        linked_at: nowISO,
      },
    },
    csrf_header: "X-CSRF-Token",
    csrf_hint: "gitrank_csrf",
  };
}
