import type { Metadata } from "next";
import { QuestsPageClient } from "@/features/quests/components/QuestsPageClient";

export const metadata: Metadata = {
  title: "Quests",
  description: "Daily, weekly, long-term, and skill quests generated from contribution evidence.",
};

export default function QuestsPage() {
  return <QuestsPageClient />;
}
