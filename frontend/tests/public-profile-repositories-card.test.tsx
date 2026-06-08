import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProfileRepositoriesCard } from "@/features/profile/components/PublicProfileRepositoriesCard";
import type { ProfileRepositorySummary } from "@/types/gitrank";

describe("PublicProfileRepositoriesCard", () => {
  it("renders the empty repository signal state", () => {
    render(<PublicProfileRepositoriesCard repositories={[]} />);

    expect(screen.getByText("No repository signal yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open contributions" }).getAttribute("href")).toBe(
      "/dashboard/contributions",
    );
  });

  it("renders the top three repositories with rank and XP", () => {
    render(
      <PublicProfileRepositoriesCard
        repositories={[
          buildRepository({ name: "octo/api", totalXp: 420, primarySkill: "Backend" }),
          buildRepository({ name: "octo/docs", totalXp: 120, contributionCount: 1 }),
          buildRepository({ name: "octo/tests", totalXp: 300, primarySkill: "Testing" }),
          buildRepository({ name: "octo/hidden-fourth", totalXp: 999 }),
        ]}
      />,
    );

    expect(screen.getByText("octo/api")).toBeTruthy();
    expect(screen.getByText("octo/docs")).toBeTruthy();
    expect(screen.getByText("octo/tests")).toBeTruthy();
    expect(screen.queryByText("octo/hidden-fourth")).toBeNull();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.getByText("#3")).toBeTruthy();
    expect(screen.getByText("420")).toBeTruthy();
    expect(screen.getAllByText(/2 scored contributions/)).toHaveLength(2);
    expect(screen.getByText("1 scored contribution")).toBeTruthy();
    expect(screen.getByText(/Backend/)).toBeTruthy();
  });

  it("renders repeated repository names when repository metrics differ", () => {
    render(
      <PublicProfileRepositoriesCard
        repositories={[
          buildRepository({ name: "octo/api", totalXp: 420, contributionCount: 2 }),
          buildRepository({ name: "octo/api", totalXp: 120, contributionCount: 1 }),
        ]}
      />,
    );

    expect(screen.getAllByText("octo/api")).toHaveLength(2);
    expect(screen.getByText("420")).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
  });
});

function buildRepository(
  overrides: Partial<ProfileRepositorySummary> = {},
): ProfileRepositorySummary {
  const name = overrides.name ?? "octo/repo";
  const [owner = "octo", repo = "repo"] = name.split("/");

  return {
    name,
    owner,
    repo,
    totalXp: overrides.totalXp ?? 200,
    contributionCount: overrides.contributionCount ?? 2,
    visibility: overrides.visibility ?? "Public",
    primarySkill: overrides.primarySkill,
  };
}
