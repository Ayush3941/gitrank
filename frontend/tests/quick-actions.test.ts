import { describe, expect, it, vi } from "vitest";
import { filterQuickActions, type QuickActionItem } from "@/lib/quick-actions";

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
