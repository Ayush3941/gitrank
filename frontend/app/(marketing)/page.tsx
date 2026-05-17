import type { Metadata } from "next";
import { LandingPage } from "@/features/marketing/components/LandingPage";
import { absolutePublicURL } from "@/lib/seo/public-url";

export const metadata: Metadata = {
  title: "Open-source reputation from evidence",
  description:
    "GitRank turns meaningful pull-request work into explainable score movement, progression, and shareable contributor identity.",
  alternates: {
    canonical: absolutePublicURL("/"),
  },
  openGraph: {
    title: "GitRank: open-source reputation from evidence",
    description:
      "Evidence-backed contribution scoring, progression, and public contributor profiles.",
    url: absolutePublicURL("/"),
    images: [
      {
        url: absolutePublicURL("/opengraph-image"),
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GitRank: open-source reputation from evidence",
    description:
      "Evidence-backed contribution scoring, progression, and public contributor profiles.",
    images: [absolutePublicURL("/twitter-image")],
  },
};

export default function HomePage() {
  return <LandingPage />;
}
