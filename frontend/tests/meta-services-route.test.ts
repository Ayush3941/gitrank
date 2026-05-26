import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("meta services route", () => {
  beforeEach(() => {
    process.env.GITRANK_API_BASE_URL = "http://localhost:8080";
    process.env.GITRANK_AUTH_BASE_URL = "http://localhost:8081";
    process.env.GITHUB_INGESTOR_BASE_URL = "http://localhost:8082";
    process.env.PR_ANALYZER_BASE_URL = "http://localhost:8083";
    process.env.PROFILE_SERVICE_BASE_URL = "http://localhost:8084";
    process.env.SCORING_ENGINE_BASE_URL = "http://localhost:8085";
    process.env.SCHEDULER_WORKER_BASE_URL = "http://localhost:8086";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns service manifest probes from configured backend services", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        const url = typeof input === "string" ? input : input.toString();
        const host = new URL(url).host;
        return new Response(
          JSON.stringify({
            service: host,
            description: "manifest",
            version: "test",
            routes: [{ method: "GET", path: "/v1/meta/manifest", summary: "meta", status: "implemented" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const route = await import("@/app/api/meta/services/route");
    const response = await route.GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      generated_at: string;
      services: Array<{
        status: string;
        manifest?: { routes?: unknown[] };
      }>;
    };

    expect(body.generated_at).toBeTruthy();
    expect(body.services).toHaveLength(7);
    expect(body.services.every((service) => service.status === "ok")).toBe(true);
    expect(body.services.every((service) => (service.manifest?.routes?.length ?? 0) >= 1)).toBe(true);
  });
});
