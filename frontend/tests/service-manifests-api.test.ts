import { afterEach, describe, expect, it, vi } from "vitest";
import { getServiceManifestProbes } from "@/lib/api/service-manifests-api";

describe("service manifests api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads probed service manifests from BFF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            generated_at: "2026-05-26T00:00:00Z",
            services: [
              {
                key: "api_gateway",
                name: "api-gateway",
                base_url: "http://localhost:8080",
                status: "ok",
                manifest: {
                  service: "api-gateway",
                  description: "Edge API",
                  version: "test",
                  routes: [],
                  dependencies: [],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const payload = await getServiceManifestProbes();
    expect(payload.services).toHaveLength(1);
    expect(payload.services[0]?.name).toBe("api-gateway");
  });
});
