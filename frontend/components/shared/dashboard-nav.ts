import { Award, Flag, LayoutDashboard, Settings, Shield } from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/contributions",
    label: "Contributions",
    icon: Shield,
  },
  {
    href: "/dashboard/badges",
    label: "Badges",
    icon: Award,
  },
  {
    href: "/dashboard/quests",
    label: "Quests",
    icon: Flag,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
];
