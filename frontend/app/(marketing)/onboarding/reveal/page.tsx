import type { Metadata } from "next";
import { RevealPanelContainer } from "@/features/onboarding/components/RevealPanelContainer";
import { absolutePublicURL } from "@/lib/seo/public-url";

export const metadata: Metadata = {
  title: "Onboarding: Identity reveal",
  description: "Review your first GitRank identity summary, strengths, XP, level, and contribution signals.",
  alternates: {
    canonical: absolutePublicURL("/onboarding/reveal"),
  },
  openGraph: {
    title: "Onboarding: Identity reveal",
    description:
      "Review your first GitRank identity summary, strengths, XP, level, and contribution signals.",
    url: absolutePublicURL("/onboarding/reveal"),
    images: [{ url: absolutePublicURL("/opengraph-image") }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Onboarding: Identity reveal",
    description:
      "Review your first GitRank identity summary, strengths, XP, level, and contribution signals.",
    images: [absolutePublicURL("/twitter-image")],
  },
};

export default function RevealPage() {
  return <RevealPanelContainer />;
}
