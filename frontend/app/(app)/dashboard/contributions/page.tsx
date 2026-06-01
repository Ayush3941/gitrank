import type { Metadata } from "next";
import { dashboardNavByHref } from "@/components/shared/dashboard-nav";
import { ContributionsPageClient } from "@/features/contributions/components/ContributionsPageClient";

const routeCopy = dashboardNavByHref["/dashboard/contributions"];

export const metadata: Metadata = {
  title: routeCopy.label,
  description: routeCopy.metaDescription,
};

export default function ContributionsPage() {
  return <ContributionsPageClient />;
}
