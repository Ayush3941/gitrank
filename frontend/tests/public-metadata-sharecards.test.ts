import { describe, expect, it } from "vitest";

describe("public route metadata share cards", () => {
  it("maps public profile metadata images to per-user dynamic image routes", async () => {
    const page = await import("@/app/(public)/u/[username]/page");
    const metadata = await page.generateMetadata({
      params: Promise.resolve({ username: "octo/dev" }),
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: "http://localhost:3000/u/octo%2Fdev/opengraph-image",
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      "http://localhost:3000/u/octo%2Fdev/twitter-image",
    ]);
  });

  it("maps PR report metadata images to per-PR dynamic image routes", async () => {
    const page = await import("@/app/(public)/pr/[owner]/[repo]/[number]/page");
    const metadata = await page.generateMetadata({
      params: Promise.resolve({
        owner: "acme/dev",
        repo: "repo with space",
        number: "42",
      }),
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: "http://localhost:3000/pr/acme%2Fdev/repo%20with%20space/42/opengraph-image",
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      "http://localhost:3000/pr/acme%2Fdev/repo%20with%20space/42/twitter-image",
    ]);
  });
});
