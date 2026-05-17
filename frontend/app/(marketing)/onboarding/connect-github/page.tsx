import type { Metadata } from "next";
import { ConnectGithubPanel } from "@/features/onboarding/components/ConnectGithubPanel";
import { absolutePublicURL } from "@/lib/seo/public-url";

export const metadata: Metadata = {
  title: "Onboarding: Connect GitHub",
  description: "Connect GitHub and start secure evidence sync for your GitRank profile.",
  alternates: {
    canonical: absolutePublicURL("/onboarding/connect-github"),
  },
  openGraph: {
    title: "Onboarding: Connect GitHub",
    description: "Connect GitHub and start secure evidence sync for your GitRank profile.",
    url: absolutePublicURL("/onboarding/connect-github"),
    images: [{ url: absolutePublicURL("/opengraph-image") }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Onboarding: Connect GitHub",
    description: "Connect GitHub and start secure evidence sync for your GitRank profile.",
    images: [absolutePublicURL("/twitter-image")],
  },
};

export default function ConnectGithubPage() {
  return <ConnectGithubPanel />;
}
