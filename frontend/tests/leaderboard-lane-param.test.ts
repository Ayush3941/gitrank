import { describe, expect, it } from "vitest";
import { laneParamToTab, tabToLaneParam } from "@/features/leaderboard/lib/lane-param";

describe("leaderboard lane query param mapping", () => {
  it("maps tab values into stable URL params", () => {
    expect(tabToLaneParam("Global")).toBe("global");
    expect(tabToLaneParam("Weekly XP")).toBe("weekly-xp");
    expect(tabToLaneParam("Rising Contributors")).toBe("rising-contributors");
  });

  it("maps URL params back into leaderboard tabs", () => {
    expect(laneParamToTab("backend")).toBe("Backend");
    expect(laneParamToTab("documentation")).toBe("Documentation");
    expect(laneParamToTab("WEEKLY-XP")).toBe("Weekly XP");
    expect(laneParamToTab("unknown-lane")).toBeNull();
    expect(laneParamToTab(null)).toBeNull();
  });
});
