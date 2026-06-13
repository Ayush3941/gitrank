import type { ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicProfilePageClient } from "@/features/profile/components/PublicProfilePageClient";
import { renderWithClient } from "@/tests/helpers/live-fixtures";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/api/analytics-api", () => ({
  emitAnalyticsEvent: vi.fn(),
}));

describe("PublicProfilePageClient recovery states", () => {
  it("renders a visitor-safe empty state when a public profile has no published evidence", async () => {
    vi.stubGlobal("fetch", vi.fn(publicProfileRecoveryFetch));

    renderWithClient(<PublicProfilePageClient username="missing-user" />);

    expect(await screen.findByRole("heading", { name: "No public scored profile yet" })).toBeTruthy();
    expect(
      screen.getByText(
        "This profile is hidden, missing, or has not published scored PR evidence yet.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open leaderboard" }).getAttribute("href")).toBe(
      "/dashboard/leaderboard",
    );
  });

  it("keeps retry local when the public profile BFF route fails", async () => {
    const fetchMock = vi.fn(publicProfileRecoveryFetch);
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(<PublicProfilePageClient username="unavailable-user" />);

    expect(
      await screen.findByRole("heading", { name: "Public profile evidence unavailable" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Retry the public profile fetch, or open the leaderboard while this evidence refreshes.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open leaderboard" }).getAttribute("href")).toBe(
      "/dashboard/leaderboard",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(
          ([input]) => requestPath(input as RequestInfo | URL) === "/api/profile/public/unavailable-user",
        ),
      ).toHaveLength(2);
    });
  });
});

async function publicProfileRecoveryFetch(input: RequestInfo | URL): Promise<Response> {
  const path = requestPath(input);
  if (path === "/api/profile/public/missing-user") {
    return jsonResponse({ error: { message: "public profile not found" } }, 404);
  }
  if (path === "/api/profile/public/unavailable-user") {
    return jsonResponse({ error: { message: "upstream timeout" } }, 503);
  }

  return jsonResponse({ error: { message: `Unhandled public profile fixture route: ${path}` } }, 404);
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
