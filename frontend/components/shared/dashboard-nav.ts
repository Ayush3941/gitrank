export type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
  metaDescription: string;
  icon: "dashboard" | "contributions" | "badges" | "quests" | "settings";
  exact?: boolean;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Identity snapshot, rank movement, and recent battle reports.",
    metaDescription:
      "Contribution analytics, score explanation, rank progression, and profile health in one dashboard view.",
    icon: "dashboard",
    exact: true,
  },
  {
    href: "/dashboard/contributions",
    label: "Contributions",
    description: "PR cards, timeline momentum, and repository impact lanes.",
    metaDescription:
      "Inspect PR-level contribution impact, streaks, repository spread, and timeline momentum.",
    icon: "contributions",
  },
  {
    href: "/dashboard/badges",
    label: "Badges",
    description: "Unlocked achievements, rarity lanes, and next badge targets.",
    metaDescription:
      "Track unlocked and upcoming achievement badges, rarity tiers, and story-backed progress.",
    icon: "badges",
  },
  {
    href: "/dashboard/quests",
    label: "Quests",
    description: "Daily, weekly, and skill missions from contribution evidence.",
    metaDescription:
      "Daily, weekly, long-term, and skill quests generated from contribution evidence.",
    icon: "quests",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    description: "Privacy, sync controls, and display preferences.",
    metaDescription:
      "Manage profile visibility, repository privacy, account controls, and data-export actions.",
    icon: "settings",
  },
];

export const dashboardNavByHref = dashboardNavItems.reduce<Record<string, DashboardNavItem>>((acc, item) => {
  acc[item.href] = item;
  return acc;
}, {});

export function resolveDashboardNavItem(pathname: string): DashboardNavItem {
  const matched =
    dashboardNavItems.find((item) =>
      item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? dashboardNavByHref["/dashboard"];
  return matched;
}
