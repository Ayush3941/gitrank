import { describe, expect, it } from "vitest";

describe("dashboard route metadata", () => {
  it("marks authenticated dashboard routes as noindex by default", async () => {
    const layout = await import("@/app/(app)/dashboard/layout");
    const metadata = layout.metadata;

    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    });
  });
});
