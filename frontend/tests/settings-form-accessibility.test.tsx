import { fireEvent, screen, waitFor } from "@testing-library/react";
import { computeAccessibleName } from "dom-accessibility-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPageClient } from "@/features/settings/components/SettingsPageClient";
import {
  privateProfileFixture,
  renderWithClient,
} from "@/tests/helpers/live-fixtures";

describe("settings form accessibility behavior", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=test-csrf-token";
    vi.stubGlobal("fetch", vi.fn(settingsFetch));
  });

  it("announces privacy update errors and links them to the affected controls", async () => {
    renderWithClient(<SettingsPageClient />);
    const toggle = await screen.findByRole("switch", {
      name: /Enable public profile/i,
    });
    fireEvent.click(toggle);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent || "").toContain("Privacy save failed for this account.");

    await waitFor(() => {
      expect(toggle.getAttribute("aria-invalid")).toBe("true");
    });
    const describedBy = toggle.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const describedElement = describedBy
      ? document.getElementById(describedBy)
      : null;
    expect(describedElement?.textContent || "").toContain(
      "Privacy save failed for this account.",
    );
  }, 10_000);

  it("keeps settings controls discoverable with non-empty accessible names", async () => {
    const rendered = renderWithClient(<SettingsPageClient />);
    await screen.findByRole("switch", {
      name: /Enable public profile/i,
    });

    const interactive = rendered.container.querySelectorAll(
      [
        "button",
        "input",
        "select",
        "[role='button']",
        "[role='switch']",
        "[role='tab']",
      ].join(","),
    );

    for (const element of interactive) {
      if (element.getAttribute("aria-hidden") === "true") {
        continue;
      }
      const label = computeAccessibleName(element);
      expect(
        label.trim().length,
        `${element.outerHTML} should expose a non-empty label signal`,
      ).toBeGreaterThan(0);
    }
  });
});

async function settingsFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = requestPath(input);
  const method = (init?.method || "GET").toUpperCase();

  if (path === "/api/profile/me" && method === "GET") {
    return jsonResponse(privateProfileFixture);
  }
  if (path === "/api/profile/me" && method === "PATCH") {
    return jsonResponse(
      { error: { message: "Privacy save failed for this account." } },
      500,
    );
  }
  if (path === "/api/analytics/events") {
    return jsonResponse({ status: "accepted" }, 202);
  }
  if (path === "/api/account/export") {
    return jsonResponse({ export_version: "test" });
  }
  if (path === "/api/sync/runs" && method === "GET") {
    return jsonResponse({
      runs: [],
      total: 0,
      limit: 12,
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
  if (path === "/api/profile/schema" && method === "GET") {
    return jsonResponse({
      sections: [
        { key: "summary", summary: "Overall rank, XP, strengths, and freshness", status: "implemented" },
      ],
      generated_at: new Date().toISOString(),
    });
  }
  if (path === "/api/meta/manifest" && method === "GET") {
    return jsonResponse({
      service: "gitrank-local",
      version: "dev",
      routes: [],
      dependencies: [],
    });
  }
  if (path === "/api/meta/dependencies" && method === "GET") {
    return jsonResponse({
      generated_at: new Date().toISOString(),
      dependencies: [],
    });
  }
  if (path === "/api/meta/services" && method === "GET") {
    return jsonResponse({
      generated_at: new Date().toISOString(),
      services: [],
    });
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
