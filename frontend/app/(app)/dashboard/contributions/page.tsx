import type { Metadata } from "next";
import { ContributionsPageClient } from "@/features/contributions/components/ContributionsPageClient";

export const metadata: Metadata = {
  title: "Contributions",
  description: "Inspect PR-level contribution impact, streaks, repository spread, and timeline momentum.",
};

export default function ContributionsPage() {
  return <ContributionsPageClient />;
}
