import type { Metadata } from "next";
import { PublicProfilePageClient } from "@/features/profile/components/PublicProfilePageClient";
import { absolutePublicURL } from "@/lib/seo/public-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const path = `/u/${encodeURIComponent(username)}`;
  const url = absolutePublicURL(path);
  return {
    title: `@${username}`,
    description: `Public GitRank profile for @${username}, including contribution signals, badges, and score movement.`,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `@${username} on GitRank`,
      description:
        "Public contribution profile with evidence-backed score signals, progression, and contribution highlights.",
      url,
      images: [{ url: absolutePublicURL("/background.jpg") }],
    },
    twitter: {
      card: "summary_large_image",
      title: `@${username} on GitRank`,
      description:
        "Public contribution profile with evidence-backed score signals, progression, and contribution highlights.",
      images: [absolutePublicURL("/background.jpg")],
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PublicProfilePageClient username={username} />;
}
