import type { Metadata } from "next";
import { dashboardNavByHref } from "@/components/shared/dashboard-nav";
import { BadgesPageClient } from "@/features/badges/components/BadgesPageClient";

const routeCopy = dashboardNavByHref["/dashboard/badges"];

export const metadata: Metadata = {
  title: routeCopy.label,
  description: routeCopy.metaDescription,
};

export default function BadgesPage() {
  return <BadgesPageClient />;
}
