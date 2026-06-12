import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProfileSkillCard } from "@/features/profile/components/PublicProfileSkillCard";
import type { SkillCategory, SkillNode } from "@/types/gitrank";

describe("PublicProfileSkillCard", () => {
  it("renders the empty skill evidence state", () => {
    render(<PublicProfileSkillCard skills={[]} constrainedNetwork={false} />);

    expect(screen.getByRole("note", { name: "Skill map needs scored evidence" })).toBeTruthy();
    expect(
      screen.getByText(
        "Skill signals appear after a scored profile snapshot includes visible PR evidence.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open contributions" }).getAttribute("href")).toBe(
      "/dashboard/contributions",
    );
  });

  it("renders the constrained-network skill summary without the heavy chart", () => {
    render(
      <PublicProfileSkillCard
        constrainedNetwork
        skills={[
          buildSkill({ category: "Documentation", score: 20 }),
          buildSkill({ category: "Testing", score: 91 }),
          buildSkill({ category: "Backend", score: 72 }),
          buildSkill({ category: "DevOps", score: 65 }),
          buildSkill({ category: "Security", score: 42 }),
          buildSkill({ category: "Performance", score: 38 }),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Skill map" })).toBeTruthy();
    expect(screen.getByText("Strongest lane")).toBeTruthy();
    expect(screen.getAllByText("Testing")).toHaveLength(2);
    expect(screen.getByText("Signal 91")).toBeTruthy();
    expect(screen.getByText("Backend")).toBeTruthy();
    expect(screen.queryByText("Documentation")).toBeNull();
  });
});

function buildSkill({
  category,
  score,
  delta = 0,
}: {
  category: SkillCategory;
  score: number;
  delta?: number;
}): SkillNode {
  return {
    category,
    score,
    delta,
    note: `${category} signal`,
  };
}
