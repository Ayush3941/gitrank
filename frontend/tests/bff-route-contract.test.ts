import { beforeEach, describe, expect, it, vi } from "vitest";

const proxyGateway = vi.fn(async () => new Response(null, { status: 204 }));
const proxyAuth = vi.fn(async () => new Response(null, { status: 204 }));

vi.mock("@/lib/api/gateway-server", () => ({
  proxyGateway,
}));

vi.mock("@/lib/api/auth-server", () => ({
  proxyAuth,
}));

describe("BFF route mapping contracts", () => {
  beforeEach(() => {
    proxyGateway.mockClear();
    proxyAuth.mockClear();
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

  it("maps /api/profile/public/:username GET to /v1/users/:username", async () => {
    const route = await import("@/app/api/profile/public/[username]/route");
    const request = new Request("http://gitrank.test/api/profile/public/octocat", { method: "GET" });

    await route.GET(request, { params: Promise.resolve({ username: "octocat" }) });

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/users/octocat");
  });

  it("maps /api/profile/public/:username/card GET to /v1/users/:username/card", async () => {
    const route = await import("@/app/api/profile/public/[username]/card/route");
    const request = new Request("http://gitrank.test/api/profile/public/octocat/card", { method: "GET" });

    await route.GET(request, { params: Promise.resolve({ username: "octocat" }) });

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/users/octocat/card");
  });

  it("maps /api/profile/me/quests GET to /v1/me/quests", async () => {
    const route = await import("@/app/api/profile/me/quests/route");
    const request = new Request("http://gitrank.test/api/profile/me/quests", { method: "GET" });

    await route.GET(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/me/quests");
  });

  it("maps /api/profile/schema GET to /v1/profile/schema", async () => {
    const route = await import("@/app/api/profile/schema/route");
    const request = new Request("http://gitrank.test/api/profile/schema", { method: "GET" });

    await route.GET(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/profile/schema");
  });

  it("maps /api/profile/me/repositories/:owner/:repo PATCH to /v1/me/profile/repositories/:owner/:repo", async () => {
    const route = await import("@/app/api/profile/me/repositories/[owner]/[repo]/route");
    const request = new Request("http://gitrank.test/api/profile/me/repositories/acme/repo", {
      method: "PATCH",
    });

    await route.PATCH(request, {
      params: Promise.resolve({
        owner: "acme/dev",
        repo: "repo with spaces",
      }),
    });

    expect(proxyGateway).toHaveBeenCalledWith(
      request,
      "/v1/me/profile/repositories/acme%2Fdev/repo%20with%20spaces",
    );
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

  it("maps /api/sync POST to /v1/sync", async () => {
    const route = await import("@/app/api/sync/route");
    const request = new Request("http://gitrank.test/api/sync", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/sync");
  });

  it("maps /api/sync/repository POST to /v1/sync/repository/execute", async () => {
    const route = await import("@/app/api/sync/repository/route");
    const request = new Request("http://gitrank.test/api/sync/repository", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/sync/repository/execute");
  });

  it("maps /api/sync/installation POST to /v1/sync/installation/execute", async () => {
    const route = await import("@/app/api/sync/installation/route");
    const request = new Request("http://gitrank.test/api/sync/installation", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/sync/installation/execute");
  });

  it("maps /api/sync/pull-request POST to /v1/sync/pull-request/execute", async () => {
    const route = await import("@/app/api/sync/pull-request/route");
    const request = new Request("http://gitrank.test/api/sync/pull-request", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/sync/pull-request/execute");
  });

  it("maps /api/sync/review POST to /v1/sync/review/execute", async () => {
    const route = await import("@/app/api/sync/review/route");
    const request = new Request("http://gitrank.test/api/sync/review", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/sync/review/execute");
  });

  it("maps /api/sync/issue POST to /v1/sync/issue/execute", async () => {
    const route = await import("@/app/api/sync/issue/route");
    const request = new Request("http://gitrank.test/api/sync/issue", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/sync/issue/execute");
  });

  it("maps /api/sync/commit POST to /v1/sync/commit/execute", async () => {
    const route = await import("@/app/api/sync/commit/route");
    const request = new Request("http://gitrank.test/api/sync/commit", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/sync/commit/execute");
  });

  it("maps /api/meta/manifest GET to /v1/meta/manifest", async () => {
    const route = await import("@/app/api/meta/manifest/route");
    const request = new Request("http://gitrank.test/api/meta/manifest", { method: "GET" });

    await route.GET(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/meta/manifest");
  });

  it("maps /api/meta/dependencies GET to /v1/meta/dependencies", async () => {
    const route = await import("@/app/api/meta/dependencies/route");
    const request = new Request("http://gitrank.test/api/meta/dependencies", { method: "GET" });

    await route.GET(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/meta/dependencies");
  });

  it("maps /api/account/unlink POST to /v1/me/account/unlink", async () => {
    const route = await import("@/app/api/account/unlink/route");
    const request = new Request("http://gitrank.test/api/account/unlink", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/me/account/unlink");
  });

  it("maps /api/account/delete POST to /v1/me/account/delete", async () => {
    const route = await import("@/app/api/account/delete/route");
    const request = new Request("http://gitrank.test/api/account/delete", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/me/account/delete");
  });

  it("maps /api/account/export GET to /v1/me/account/export", async () => {
    const route = await import("@/app/api/account/export/route");
    const request = new Request("http://gitrank.test/api/account/export", { method: "GET" });

    await route.GET(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/me/account/export");
  });

  it("maps /api/session/logout POST to auth-service /v1/session/logout", async () => {
    const route = await import("@/app/api/session/logout/route");
    const request = new Request("http://gitrank.test/api/session/logout", { method: "POST" });

    await route.POST(request);

    expect(proxyAuth).toHaveBeenCalledWith(request, "/v1/session/logout");
  });

  it("maps /api/account/link/start POST to auth-service /v1/account/link/start", async () => {
    const route = await import("@/app/api/account/link/start/route");
    const request = new Request("http://gitrank.test/api/account/link/start", { method: "POST" });

    await route.POST(request);

    expect(proxyAuth).toHaveBeenCalledWith(request, "/v1/account/link/start");
  });

  it("maps /api/session/me GET to auth-service /v1/session/me", async () => {
    const route = await import("@/app/api/session/me/route");
    const request = new Request("http://gitrank.test/api/session/me", { method: "GET" });

    await route.GET(request);

    expect(proxyAuth).toHaveBeenCalledWith(request, "/v1/session/me");
  });

  it("maps /api/session/refresh POST to auth-service /v1/session/refresh", async () => {
    const route = await import("@/app/api/session/refresh/route");
    const request = new Request("http://gitrank.test/api/session/refresh", { method: "POST" });

    await route.POST(request);

    expect(proxyAuth).toHaveBeenCalledWith(request, "/v1/session/refresh");
  });

  it("maps /api/analytics/events POST to /v1/analytics/events", async () => {
    const route = await import("@/app/api/analytics/events/route");
    const request = new Request("http://gitrank.test/api/analytics/events", { method: "POST" });

    await route.POST(request);

    expect(proxyGateway).toHaveBeenCalledWith(request, "/v1/analytics/events");
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
