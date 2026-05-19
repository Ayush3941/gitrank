import { Award, Flag, LayoutDashboard, Settings, Shield } from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  hint: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    mobileLabel: "Dash",
    hint: "Identity, XP, and score movement",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/contributions",
    label: "Contributions",
    mobileLabel: "PRs",
    hint: "PR impact cards and evidence timeline",
    icon: Shield,
  },
  {
    href: "/dashboard/badges",
    label: "Badges",
    mobileLabel: "Badges",
    hint: "Unlocked achievements and progress",
    icon: Award,
  },
  {
    href: "/dashboard/quests",
    label: "Quests",
    mobileLabel: "Quests",
    hint: "Daily and weekly contribution missions",
    icon: Flag,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    mobileLabel: "Settings",
    hint: "Privacy, sync, and display controls",
    icon: Settings,
  },
];
