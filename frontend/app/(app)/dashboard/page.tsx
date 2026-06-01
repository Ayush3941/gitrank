import type { Metadata } from "next";
import { dashboardNavByHref } from "@/components/shared/dashboard-nav";
import { DashboardPageClient } from "@/features/dashboard/components/DashboardPageClient";

const routeCopy = dashboardNavByHref["/dashboard"];

export const metadata: Metadata = {
  title: routeCopy.label,
  description: routeCopy.metaDescription,
};

export default function DashboardPage() {
  return <DashboardPageClient />;
}
