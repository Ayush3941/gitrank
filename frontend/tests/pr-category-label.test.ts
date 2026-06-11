import { describe, expect, it } from "vitest";
import { formatPRCategoryLabel } from "@/lib/presentation/pr-category-label";

describe("formatPRCategoryLabel", () => {
  it("keeps known PR categories user-facing", () => {
    expect(formatPRCategoryLabel("Testing")).toBe("Testing");
    expect(formatPRCategoryLabel("bug_fix")).toBe("Bug Fix");
    expect(formatPRCategoryLabel("infra")).toBe("Infrastructure");
  });

  it("uses an explicit unclassified label for missing or unknown categories", () => {
    expect(formatPRCategoryLabel()).toBe("Unclassified");
    expect(formatPRCategoryLabel("")).toBe("Unclassified");
    expect(formatPRCategoryLabel("Unknown")).toBe("Unclassified");
    expect(formatPRCategoryLabel("not-a-real-category")).toBe("Unclassified");
  });
});
