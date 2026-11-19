import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrentLeagueCard } from "@/features/dashboard/components/CurrentLeagueCard";
import type { UserProfile } from "@/types/gitrank";

describe("dashboard card icon semantics", () => {
  it("keeps league icons decorative", () => {
    const rendered = render(
      <CurrentLeagueCard user={buildLeagueUser()} />,
    );

    const icons = rendered.container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("uses explicit unavailable copy when the league season end date is invalid", () => {
    render(
      <CurrentLeagueCard
        user={buildLeagueUser({
          season: {
            endsAt: "not-a-date",
          },
        })}
      />,
    );

    expect(screen.getByText(/Ends Date unavailable/i)).toBeTruthy();
    expect(screen.queryByText(/Ends Never/i)).toBeNull();
  });
});

function buildLeagueUser(
  overrides: {
    season?: Partial<UserProfile["rankProgress"]["season"]>;
  } = {},
): UserProfile {
  return {
    movement: 2,
    leaguePosition: 4,
    weeklyXp: 320,
    level: {
      rankTier: "Gold III",
    },
    rankProgress: {
      evidenceSignals: [],
      nextTier: "Platinum I",
      seasonXp: 400,
      xpToNextTier: 100,
      season: {
        windowLabel: "May 25 - May 31",
        status: "Active",
        endsAt: "2026-05-31T23:59:59Z",
        ...overrides.season,
      },
    },
  } as unknown as UserProfile;
}
