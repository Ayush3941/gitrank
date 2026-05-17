import type { Metadata } from "next";
import { JsonLdScript } from "@/components/shared/JsonLdScript";
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
  const ogPath = `${path}/opengraph-image`;
  const twitterPath = `${path}/twitter-image`;
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
      images: [{ url: absolutePublicURL(ogPath) }],
    },
    twitter: {
      card: "summary_large_image",
      title: `@${username} on GitRank`,
      description:
        "Public contribution profile with evidence-backed score signals, progression, and contribution highlights.",
      images: [absolutePublicURL(twitterPath)],
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const path = `/u/${encodeURIComponent(username)}`;
  const url = absolutePublicURL(path);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `GitRank profile for @${username}`,
    url,
    mainEntity: {
      "@type": "Person",
      name: username,
      identifier: username,
      url,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "GitRank",
      url: absolutePublicURL("/"),
    },
  };

  return (
    <>
      <JsonLdScript id="public-profile-jsonld" data={jsonLd} />
      <PublicProfilePageClient username={username} />
    </>
  );
}
