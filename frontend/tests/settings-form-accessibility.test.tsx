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
    await screen.findByText("Settings and privacy");

    const toggle = screen.getByRole("switch", {
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
  });

  it("keeps settings controls discoverable with non-empty accessible names", async () => {
    const rendered = renderWithClient(<SettingsPageClient />);
    await screen.findByText("Settings and privacy");

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
