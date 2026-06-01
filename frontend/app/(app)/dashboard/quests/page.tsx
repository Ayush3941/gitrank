import type { Metadata } from "next";
import { dashboardNavByHref } from "@/components/shared/dashboard-nav";
import { QuestsPageClient } from "@/features/quests/components/QuestsPageClient";

const routeCopy = dashboardNavByHref["/dashboard/quests"];

export const metadata: Metadata = {
  title: routeCopy.label,
  description: routeCopy.metaDescription,
};

export default function QuestsPage() {
  return <QuestsPageClient />;
}
