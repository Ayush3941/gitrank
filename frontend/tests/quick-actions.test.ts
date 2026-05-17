import { describe, expect, it, vi } from "vitest";
import {
  filterQuickActions,
  groupQuickActions,
  promoteRecentActions,
  type QuickActionItem,
} from "@/lib/quick-actions";

function action(id: string, label: string, description: string, keywords?: string[]): QuickActionItem {
  return {
    id,
    label,
    description,
    keywords,
    execute: vi.fn(),
  };
}

describe("filterQuickActions", () => {
  const actions: QuickActionItem[] = [
    action("go:dashboard", "Go to Dashboard", "Open dashboard lane", ["home", "overview"]),
    action("go:contrib", "Go to Contributions", "Open contribution lane", ["prs", "pull requests"]),
    action("sync", "Run GitHub sync now", "Refresh evidence", ["github", "refresh"]),
  ];

  it("returns all actions when query is empty", () => {
    expect(filterQuickActions(actions, "")).toHaveLength(actions.length);
  });

  it("prioritizes label prefix matches", () => {
    const result = filterQuickActions(actions, "go to");
    expect(result[0]?.id).toBe("go:contrib");
    expect(result[1]?.id).toBe("go:dashboard");
  });

  it("matches keyword terms when label does not contain query", () => {
    const result = filterQuickActions(actions, "pull requests");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("go:contrib");
  });

  it("returns empty array for unmatched query", () => {
    expect(filterQuickActions(actions, "unrelated")).toEqual([]);
  });
});

describe("groupQuickActions", () => {
  it("groups actions while preserving first-seen group order", () => {
    const actions: QuickActionItem[] = [
      { ...action("a", "A", "desc"), group: "Navigate" },
      { ...action("b", "B", "desc"), group: "Display" },
      { ...action("c", "C", "desc"), group: "Navigate" },
      action("d", "D", "desc"),
    ];

    const grouped = groupQuickActions(actions);
    expect(grouped.map((entry) => entry.title)).toEqual(["Navigate", "Display", "Other"]);
    expect(grouped[0]?.items.map((entry) => entry.id)).toEqual(["a", "c"]);
    expect(grouped[2]?.items.map((entry) => entry.id)).toEqual(["d"]);
  });
});

describe("promoteRecentActions", () => {
  it("moves recent actions to top and tags them with Recent group", () => {
    const actions: QuickActionItem[] = [
      { ...action("one", "One", "desc"), group: "Navigate" },
      { ...action("two", "Two", "desc"), group: "Navigate" },
      { ...action("three", "Three", "desc"), group: "Display" },
    ];

    const promoted = promoteRecentActions(actions, ["three", "one"]);
    expect(promoted.map((entry) => entry.id)).toEqual(["three", "one", "two"]);
    expect(promoted[0]?.group).toBe("Recent");
    expect(promoted[1]?.group).toBe("Recent");
    expect(promoted[2]?.group).toBe("Navigate");
  });

  it("ignores unknown recent ids", () => {
    const actions: QuickActionItem[] = [
      { ...action("one", "One", "desc"), group: "Navigate" },
      { ...action("two", "Two", "desc"), group: "Navigate" },
    ];
    const promoted = promoteRecentActions(actions, ["missing", "one"]);
    expect(promoted.map((entry) => entry.id)).toEqual(["one", "two"]);
  });
});
