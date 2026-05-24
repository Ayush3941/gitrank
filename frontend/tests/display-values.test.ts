import { describe, expect, it } from "vitest";
import { uniqueDisplayValues } from "@/lib/display-values";
import { normalizeSkillCategory } from "@/lib/presentation/skill-normalization";

describe("uniqueDisplayValues", () => {
  it("deduplicates equivalent skill labels", () => {
    const values = uniqueDisplayValues([
      "Backend",
      "Back-end",
      "back end",
      "Frontend",
      "Front-end",
      "Quality Assurance",
      "Testing",
    ]);

    expect(values).toEqual(["Backend", "Frontend", "Quality Assurance"]);
  });
});

describe("normalizeSkillCategory", () => {
  it("maps devops family to infrastructure", () => {
    expect(normalizeSkillCategory("devops")).toBe("infrastructure");
    expect(normalizeSkillCategory("Dev Ops")).toBe("infrastructure");
  });
});
