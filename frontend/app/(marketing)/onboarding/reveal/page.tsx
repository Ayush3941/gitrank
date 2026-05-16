import type { Metadata } from "next";
import { RevealPanelContainer } from "@/features/onboarding/components/RevealPanelContainer";

export const metadata: Metadata = {
  title: "Onboarding: Identity reveal",
  description: "Review your first GitRank identity summary, strengths, XP, level, and contribution signals.",
};

export default function RevealPage() {
  return <RevealPanelContainer />;
}
