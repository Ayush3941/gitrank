import { describe, expect, it } from "vitest";
import { buildEvidenceSignalChips } from "@/lib/presentation/evidence-signal";

describe("buildEvidenceSignalChips", () => {
  it("formats singular deterministic evidence counts naturally", () => {
    expect(
      buildEvidenceSignalChips([
        "files=1",
        "source_files=1",
        "commits=1",
        "linked_issues=1",
        "active_weeks=1",
        "repository_count=1",
        "contribution_span=1",
        "1 changed files persisted",
      ]),
    ).toEqual([
      "1 file changed",
      "1 source file",
      "1 commit",
      "1 linked issue",
      "1 active week",
      "1 repository touched",
      "Contribution span 1 day",
    ]);
  });

  it("keeps plural deterministic evidence counts natural", () => {
    expect(
      buildEvidenceSignalChips([
        "files=2",
        "source_files=3",
        "commits=4",
        "linked_issues=5",
        "active_weeks=6",
        "repository_count=7",
        "contribution_span=8",
      ]),
    ).toEqual([
      "2 files changed",
      "3 source files",
      "4 commits",
      "5 linked issues",
      "6 active weeks",
      "7 repositories touched",
      "Contribution span 8 days",
    ]);
  });
});
