import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionEnvelope, refreshSession } from "@/lib/api/session-api";

describe("session api", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=session-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads session envelope from auth proxy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            session: {
              subject: "11111111-1111-1111-1111-111111111111",
              github_authorization_status: "active",
              session_expires_at: "2026-05-20T00:00:00Z",
              session_idle_expires_at: "2026-05-19T06:00:00Z",
              session_rotated_at: "2026-05-19T00:00:00Z",
              linked_account: {
                github_user_id: 1,
                login: "octocat",
                linked_at: "2026-05-01T00:00:00Z",
                status: "linked",
              },
            },
            csrf_header: "X-CSRF-Token",
            csrf_hint: "present",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const envelope = await getSessionEnvelope();
    expect(envelope.session.linked_account.login).toBe("octocat");
  });

  it("refreshes session through auth proxy with csrf header", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          session: {
            subject: "11111111-1111-1111-1111-111111111111",
            github_authorization_status: "active",
            session_expires_at: "2026-05-20T00:00:00Z",
            session_idle_expires_at: "2026-05-19T06:00:00Z",
            session_rotated_at: "2026-05-19T00:00:00Z",
            linked_account: {
              github_user_id: 1,
              login: "octocat",
              linked_at: "2026-05-01T00:00:00Z",
              status: "linked",
            },
          },
          csrf_header: "X-CSRF-Token",
          csrf_hint: "present",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await refreshSession();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session/refresh",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-CSRF-Token": "session-token",
        }),
      }),
    );
  });

  it("returns parsed auth error text for failed refresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: { message: "authentication required" },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(refreshSession()).rejects.toThrow("authentication required");
  });
});
