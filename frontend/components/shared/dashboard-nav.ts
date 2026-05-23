export type DashboardNavItem = {
  href: string;
  label: string;
  icon: "dashboard" | "contributions" | "badges" | "quests" | "settings";
  exact?: boolean;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    exact: true,
  },
  {
    href: "/dashboard/contributions",
    label: "Contributions",
    icon: "contributions",
  },
  {
    href: "/dashboard/badges",
    label: "Badges",
    icon: "badges",
  },
  {
    href: "/dashboard/quests",
    label: "Quests",
    icon: "quests",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: "settings",
  },
];
