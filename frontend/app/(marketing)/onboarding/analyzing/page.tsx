import type { Metadata } from "next";
import { SyncPipeline } from "@/features/onboarding/components/SyncPipeline";
import { absolutePublicURL } from "@/lib/seo/public-url";

export const metadata: Metadata = {
  title: "Onboarding: Sync and analyze",
  description: "GitRank is syncing and analyzing your contribution history to build your initial profile snapshot.",
  alternates: {
    canonical: absolutePublicURL("/onboarding/analyzing"),
  },
  openGraph: {
    title: "Onboarding: Sync and analyze",
    description:
      "GitRank is syncing and analyzing your contribution history to build your initial profile snapshot.",
    url: absolutePublicURL("/onboarding/analyzing"),
    images: [{ url: absolutePublicURL("/opengraph-image") }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Onboarding: Sync and analyze",
    description:
      "GitRank is syncing and analyzing your contribution history to build your initial profile snapshot.",
    images: [absolutePublicURL("/twitter-image")],
  },
};

export default function AnalyzingPage() {
  return <SyncPipeline />;
}
