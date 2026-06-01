import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPageClient } from "@/features/settings/components/SettingsPageClient";
import {
  privateProfileFixture,
  renderWithClient,
} from "@/tests/helpers/live-fixtures";

describe("settings sync activity disclosure", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=test-csrf-token";
  });

  it("keeps sync activity details collapsed when runs are healthy", async () => {
    vi.stubGlobal("fetch", vi.fn((input, init) => settingsFetch(input, init, "healthy")));

    renderWithClient(<SettingsPageClient />);
    await screen.findByRole("heading", { name: "Settings" });

    expect(await screen.findByRole("button", { name: /Show details/i })).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Show details/i })).toBeNull();
    expect(screen.queryByText("Recent sync runs")).toBeNull();
  }, 10_000);

  it("auto-expands sync activity details when runs need attention", async () => {
    vi.stubGlobal("fetch", vi.fn((input, init) => settingsFetch(input, init, "attention")));

    renderWithClient(<SettingsPageClient />);
    await screen.findByRole("heading", { name: "Settings" });

    expect(await screen.findByRole("button", { name: /Hide details/i })).toBeTruthy();
    expect(await screen.findByRole("region", { name: /Hide details/i })).toBeTruthy();
    expect(await screen.findByText("Recent sync runs")).toBeTruthy();
    expect(await screen.findByText("1 failed")).toBeTruthy();
  }, 10_000);

  it("keeps sync activity details open after manual refresh resolves to healthy runs", async () => {
    let syncRunFetchCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((input, init) => {
        const path = requestPath(input);
        const method = (init?.method || "GET").toUpperCase();

        if (path === "/api/profile/me" && method === "GET") {
          return Promise.resolve(jsonResponse(privateProfileFixture));
        }
        if (path === "/api/sync/runs" && method === "GET") {
          syncRunFetchCount += 1;
          if (syncRunFetchCount === 1) {
            return Promise.resolve(jsonResponse({
              runs: [
                {
                  id: "run-failed-1",
                  run_type: "user",
                  status: "failed",
                  subject: "@live-maintainer",
                  started_at: "2026-05-30T10:00:00Z",
                  finished_at: "2026-05-30T10:00:15Z",
                  last_error: "sync_config_unavailable",
                },
              ],
              total: 1,
              limit: 25,
              offset: 0,
            }));
          }
          return Promise.resolve(jsonResponse({
            runs: [
              {
                id: "run-completed-1",
                run_type: "user",
                status: "completed",
                subject: "@live-maintainer",
                started_at: "2026-05-30T10:00:00Z",
                finished_at: "2026-05-30T10:00:10Z",
              },
            ],
            total: 1,
            limit: 25,
            offset: 0,
          }));
        }
        if (path === "/api/session/me" && method === "GET") {
          const nowISO = new Date().toISOString();
          return Promise.resolve(jsonResponse({
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
          }));
        }
        if (path === "/api/analytics/events") {
          return Promise.resolve(jsonResponse({ status: "accepted" }, 202));
        }
        return Promise.resolve(jsonResponse({ error: { message: `Unhandled route: ${path}` } }, 404));
      }),
    );

    renderWithClient(<SettingsPageClient />);
    await screen.findByRole("heading", { name: "Settings" });

    expect(await screen.findByRole("button", { name: /Hide details/i })).toBeTruthy();
    const refreshButton = await screen.findByRole("button", { name: /Refresh log/i });
    fireEvent.click(refreshButton);

    expect(await screen.findByRole("button", { name: /Hide details/i })).toBeTruthy();
    expect(await screen.findByText("Recent sync runs")).toBeTruthy();
  }, 10_000);
});

async function settingsFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  mode: "healthy" | "attention",
): Promise<Response> {
  const path = requestPath(input);
  const method = (init?.method || "GET").toUpperCase();

  if (path === "/api/profile/me" && method === "GET") {
    return jsonResponse(privateProfileFixture);
  }
  if (path === "/api/sync/runs" && method === "GET") {
    if (mode === "attention") {
      return jsonResponse({
        runs: [
          {
            id: "run-failed-1",
            run_type: "user",
            status: "failed",
            subject: "@live-maintainer",
            started_at: "2026-05-30T10:00:00Z",
            finished_at: "2026-05-30T10:00:15Z",
            last_error: "sync_config_unavailable",
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      });
    }
    return jsonResponse({
      runs: [
        {
          id: "run-completed-1",
          run_type: "user",
          status: "completed",
          subject: "@live-maintainer",
          started_at: "2026-05-30T10:00:00Z",
          finished_at: "2026-05-30T10:00:10Z",
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
    });
  }
  if (path === "/api/session/me" && method === "GET") {
    const nowISO = new Date().toISOString();
    return jsonResponse({
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
    });
  }
  if (path === "/api/analytics/events") {
    return jsonResponse({ status: "accepted" }, 202);
  }

  return jsonResponse({ error: { message: `Unhandled route: ${path}` } }, 404);
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
