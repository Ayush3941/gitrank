import { beforeEach, describe, expect, it, vi } from "vitest";

const proxyGateway = vi.fn(async () => new Response(null, { status: 204 }));

vi.mock("@/lib/api/gateway-server", () => ({
  proxyGateway,
}));

describe("BFF route mapping contracts", () => {
  beforeEach(() => {
    proxyGateway.mockClear();
  });

  it("maps /api/profile/me GET and PATCH to /v1/me/profile", async () => {
    const route = await import("@/app/api/profile/me/route");
    const getRequest = new Request("http://gitrank.test/api/profile/me", { method: "GET" });
    const patchRequest = new Request("http://gitrank.test/api/profile/me", { method: "PATCH" });

    await route.GET(getRequest);
    await route.PATCH(patchRequest);

    expect(proxyGateway).toHaveBeenNthCalledWith(1, getRequest, "/v1/me/profile");
    expect(proxyGateway).toHaveBeenNthCalledWith(2, patchRequest, "/v1/me/profile");
  });

  it("maps /api/profile/me/quests GET to /v1/me/quests", async () => {
    const route = await import("@/app/api/profile/me/quests/route");
    const request = new Request("http://gitrank.test/api/profile/me/quests", { method: "GET" });

    await route.GET(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/me/quests");
  });

  it("maps /api/leaderboard GET to /v1/leaderboard", async () => {
    const route = await import("@/app/api/leaderboard/route");
    const request = new Request("http://gitrank.test/api/leaderboard", { method: "GET" });

    await route.GET(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/leaderboard");
  });

  it("maps /api/sync/user POST to /v1/sync/user/execute", async () => {
    const route = await import("@/app/api/sync/user/route");
    const request = new Request("http://gitrank.test/api/sync/user", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/sync/user/execute");
  });

  it("maps /api/sync/runs GET to /v1/sync/runs", async () => {
    const route = await import("@/app/api/sync/runs/route");
    const request = new Request("http://gitrank.test/api/sync/runs?limit=10", { method: "GET" });

    await route.GET(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/sync/runs");
  });

  it("maps PR report route params to encoded /v1/pr/.../report path", async () => {
    const route = await import("@/app/api/pr/[owner]/[repo]/[number]/report/route");
    const request = new Request("http://gitrank.test/api/pr/acme/repo/42/report", { method: "GET" });

    await route.GET(request, {
      params: Promise.resolve({
        owner: "acme/dev",
        repo: "repo with spaces",
        number: "42",
      }),
    });

    expect(proxyGateway).toHaveBeenCalledWith(
      request,
      "/v1/pr/acme%2Fdev/repo%20with%20spaces/42/report",
    );
  });
});
