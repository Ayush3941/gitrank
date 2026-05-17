import { describe, expect, it } from "vitest";

describe("marketing route metadata", () => {
  it("keeps landing page share metadata on generated brand cards", async () => {
    const page = await import("@/app/(marketing)/page");
    const metadata = page.metadata;

    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/");
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "http://localhost:3000/opengraph-image",
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      "http://localhost:3000/twitter-image",
    ]);
  });

  it("keeps login page share metadata aligned with generated brand cards", async () => {
    const page = await import("@/app/(marketing)/login/page");
    const metadata = page.metadata;

    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/login");
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "http://localhost:3000/opengraph-image",
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      "http://localhost:3000/twitter-image",
    ]);
  });

  it("keeps onboarding routes canonical and branded-share ready", async () => {
    const connect = await import("@/app/(marketing)/onboarding/connect-github/page");
    const analyzing = await import("@/app/(marketing)/onboarding/analyzing/page");
    const reveal = await import("@/app/(marketing)/onboarding/reveal/page");

    expect(connect.metadata.alternates?.canonical).toBe(
      "http://localhost:3000/onboarding/connect-github",
    );
    expect(analyzing.metadata.alternates?.canonical).toBe(
      "http://localhost:3000/onboarding/analyzing",
    );
    expect(reveal.metadata.alternates?.canonical).toBe(
      "http://localhost:3000/onboarding/reveal",
    );

    for (const metadata of [connect.metadata, analyzing.metadata, reveal.metadata]) {
      expect(metadata.openGraph?.images).toEqual([
        {
          url: "http://localhost:3000/opengraph-image",
        },
      ]);
      expect(metadata.twitter?.images).toEqual([
        "http://localhost:3000/twitter-image",
      ]);
    }
  });
});
