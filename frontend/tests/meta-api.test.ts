import { afterEach, describe, expect, it, vi } from "vitest";
import { getServiceDependencies, getServiceManifest } from "@/lib/api/meta-api";

describe("meta api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads service manifest from BFF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            service: "api-gateway",
            description: "Edge API",
            version: "test",
            routes: [{ method: "GET", path: "/v1/meta/manifest", summary: "Manifest", status: "implemented" }],
            dependencies: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const manifest = await getServiceManifest();
    expect(manifest.service).toBe("api-gateway");
    expect(manifest.routes).toHaveLength(1);
  });

  it("loads service dependencies from dedicated endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              name: "profile-service",
              kind: "internal_http",
              purpose: "Profile read models",
              critical: true,
              status: "configured",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const dependencies = await getServiceDependencies();
    expect(dependencies).toHaveLength(1);
    expect(dependencies[0]?.name).toBe("profile-service");
  });
});
