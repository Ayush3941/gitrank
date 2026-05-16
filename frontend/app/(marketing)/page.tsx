import type { Metadata } from "next";
import { LandingPage } from "@/features/marketing/components/LandingPage";

export const metadata: Metadata = {
  title: "Open-source reputation from evidence",
  description:
    "GitRank turns meaningful pull-request work into explainable score movement, progression, and shareable contributor identity.",
};

export default function HomePage() {
  return <LandingPage />;
}
