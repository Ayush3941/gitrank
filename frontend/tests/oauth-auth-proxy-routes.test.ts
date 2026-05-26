import { beforeEach, describe, expect, it, vi } from "vitest";

const proxyAuth = vi.fn();

vi.mock("@/lib/api/auth-server", () => ({
  proxyAuth,
}));

describe("oauth auth proxy routes", () => {
  beforeEach(() => {
    proxyAuth.mockReset();
  });

  it("maps oauth start route to auth-service and redirects to authorize_url", async () => {
    proxyAuth.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authorize_url: "https://github.com/login/oauth/authorize?client_id=test",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const route = await import("@/app/oauth/github/start/route");
    const request = new Request("http://gitrank.test/oauth/github/start?return_to=/dashboard/settings");
    const response = await route.GET(request);

    expect(proxyAuth).toHaveBeenCalledWith(
      request,
      "/oauth/github/start?response_mode=json&return_to=%2Fdashboard%2Fsettings",
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://github.com/login/oauth/authorize?client_id=test",
    );
  });

  it("maps oauth callback route to auth-service and redirects to callback redirect_url", async () => {
    proxyAuth.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          redirect_url: "/dashboard",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const route = await import("@/app/oauth/github/callback/route");
    const request = new Request("http://gitrank.test/oauth/github/callback?code=abc&state=xyz");
    const response = await route.GET(request);

    expect(proxyAuth).toHaveBeenCalledWith(
      request,
      "/oauth/github/callback?code=abc&state=xyz&response_mode=json",
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/dashboard");
  });

  it("maps oauth install route to auth-service preview endpoint and redirects to install_url", async () => {
    proxyAuth.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          install_url: "https://github.com/apps/gitrank-local-app/installations/new",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const route = await import("@/app/oauth/github/install/route");
    const request = new Request("http://gitrank.test/oauth/github/install");
    const response = await route.GET(request);

    expect(proxyAuth).toHaveBeenCalledWith(request, "/oauth/github/install?preview=1");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://github.com/apps/gitrank-local-app/installations/new",
    );
  });
});
