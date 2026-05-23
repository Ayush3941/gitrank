export type DashboardNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    exact: true,
  },
  {
    href: "/dashboard/contributions",
    label: "Contributions",
  },
  {
    href: "/dashboard/badges",
    label: "Badges",
  },
  {
    href: "/dashboard/quests",
    label: "Quests",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
  },
];
