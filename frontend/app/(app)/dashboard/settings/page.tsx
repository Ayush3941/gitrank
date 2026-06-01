import type { Metadata } from "next";
import { dashboardNavByHref } from "@/components/shared/dashboard-nav";
import { SettingsPageClient } from "@/features/settings/components/SettingsPageClient";

const routeCopy = dashboardNavByHref["/dashboard/settings"];

export const metadata: Metadata = {
  title: routeCopy.label,
  description: routeCopy.metaDescription,
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
