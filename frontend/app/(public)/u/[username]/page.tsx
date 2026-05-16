import type { Metadata } from "next";
import { PublicProfilePageClient } from "@/features/profile/components/PublicProfilePageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}`,
    description: `Public GitRank profile for @${username}, including contribution signals, badges, and score movement.`,
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
