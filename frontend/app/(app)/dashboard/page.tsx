import type { Metadata } from "next";
import { DashboardPageClient } from "@/features/dashboard/components/DashboardPageClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Contribution analytics, score explanation, rank progression, and core profile health in one command center.",
};

export default function DashboardPage() {
  return <DashboardPageClient />;
}
