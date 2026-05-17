import type { LucideIcon } from "lucide-react";

export type QuickActionItem = {
  id: string;
  label: string;
  description: string;
  group?: string;
  keywords?: string[];
  shortcut?: string;
  icon?: LucideIcon;
  execute: () => void;
};

type RankedAction = {
  action: QuickActionItem;
  score: number;
};

export function filterQuickActions(
  actions: readonly QuickActionItem[],
  query: string,
): QuickActionItem[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [...actions];
  }

  const ranked = actions
    .map((action) => ({ action, score: scoreAction(action, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort(compareRankedActions);

  return ranked.map((entry) => entry.action);
}

export function groupQuickActions(
  actions: readonly QuickActionItem[],
): Array<{ title: string; items: QuickActionItem[] }> {
  const grouped = new Map<string, QuickActionItem[]>();
  for (const action of actions) {
    const groupTitle = action.group?.trim() || "Other";
    if (!grouped.has(groupTitle)) {
      grouped.set(groupTitle, []);
    }
    grouped.get(groupTitle)?.push(action);
  }
  return [...grouped.entries()].map(([title, items]) => ({
    title,
    items,
  }));
}

export function promoteRecentActions(
  actions: readonly QuickActionItem[],
  recentIds: readonly string[],
  groupTitle = "Recent",
): QuickActionItem[] {
  if (!actions.length || !recentIds.length) {
    return [...actions];
  }

  const promoted = recentIds
    .map((actionId) => actions.find((entry) => entry.id === actionId))
    .filter(Boolean)
    .map((entry) => ({ ...entry, group: groupTitle } as QuickActionItem));

  if (!promoted.length) {
    return [...actions];
  }

  const promotedIds = new Set(promoted.map((entry) => entry.id));
  const rest = actions.filter((entry) => !promotedIds.has(entry.id));
  return [...promoted, ...rest];
}

function scoreAction(action: QuickActionItem, query: string): number {
  const label = normalize(action.label);
  const description = normalize(action.description);
  const keywords = normalize((action.keywords ?? []).join(" "));

  if (label === query) {
    return 120;
  }
  if (label.startsWith(query)) {
    return 100;
  }
  if (label.includes(query)) {
    return 80;
  }
  if (keywords.startsWith(query)) {
    return 68;
  }
  if (keywords.includes(query)) {
    return 56;
  }
  if (description.includes(query)) {
    return 42;
  }
  return 0;
}

function compareRankedActions(left: RankedAction, right: RankedAction) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  return left.action.label.localeCompare(right.action.label);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
