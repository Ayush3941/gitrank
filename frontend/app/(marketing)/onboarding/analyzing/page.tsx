import type { Metadata } from "next";
import { SyncPipeline } from "@/features/onboarding/components/SyncPipeline";

export const metadata: Metadata = {
  title: "Onboarding: Sync and analyze",
  description: "GitRank is syncing and analyzing your contribution history to build your initial profile snapshot.",
};

export default function AnalyzingPage() {
  return <SyncPipeline />;
}
