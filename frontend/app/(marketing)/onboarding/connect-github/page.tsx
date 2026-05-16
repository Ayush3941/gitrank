import type { Metadata } from "next";
import { ConnectGithubPanel } from "@/features/onboarding/components/ConnectGithubPanel";

export const metadata: Metadata = {
  title: "Onboarding: Connect GitHub",
  description: "Connect GitHub and start secure evidence sync for your GitRank profile.",
};

export default function ConnectGithubPage() {
  return <ConnectGithubPanel />;
}
