import { describe, expect, it } from "vitest";
import { buildContributionsCSV } from "@/features/contributions/lib/contribution-csv-export";
import { buildContribution } from "@/tests/helpers/contribution-fixture";

describe("buildContributionsCSV", () => {
  it("writes stable headers, PR URLs, and escaped user-facing fields", () => {
    const csv = buildContributionsCSV([
      buildContribution({
        owner: "octo",
        repo: "quoted-repo",
        number: 7,
        title: "Fix \"quoted\", title",
        aiSummary: "Summary with \"quotes\", commas, and\nnewlines.",
      }),
    ]);

    expect(csv.startsWith("\uFEFFpr_url,owner,repo,number,title,status")).toBe(true);
    expect(csv).toContain("\"https://github.com/octo/quoted-repo/pull/7\"");
    expect(csv).toContain("\"Fix \"\"quoted\"\", title\"");
    expect(csv).toContain("\"Summary with \"\"quotes\"\", commas, and newlines.\"");
  });

  it("exports unclassified category labels instead of raw unknown fallback", () => {
    const csv = buildContributionsCSV([
      buildContribution({
        category: "Unknown",
      }),
    ]);

    expect(csv).toContain(",\"Unclassified\",");
    expect(csv).not.toContain(",\"Unknown\",");
  });
});
