import { Award, Flag, LayoutDashboard, Settings, Shield } from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    mobileLabel: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/contributions",
    label: "Contributions",
    mobileLabel: "Contributions",
    icon: Shield,
  },
  {
    href: "/dashboard/badges",
    label: "Badges",
    mobileLabel: "Badges",
    icon: Award,
  },
  {
    href: "/dashboard/quests",
    label: "Quests",
    mobileLabel: "Quests",
    icon: Flag,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    mobileLabel: "Settings",
    icon: Settings,
  },
];
