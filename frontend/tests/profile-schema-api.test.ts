import { afterEach, describe, expect, it, vi } from "vitest";
import { getProfileSchema } from "@/lib/api/profile-schema-api";

describe("profile schema api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads profile schema sections from BFF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            sections: [
              { key: "summary", summary: "Overall rank, XP, strengths, and freshness", status: "implemented" },
              { key: "skills", summary: "Top skill areas derived from scored evidence", status: "implemented" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const sections = await getProfileSchema();
    expect(sections).toHaveLength(2);
    expect(sections[0]?.key).toBe("summary");
  });

  it("returns backend error text when schema request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "profile schema unavailable",
            },
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(getProfileSchema()).rejects.toThrow("profile schema unavailable");
  });
});
