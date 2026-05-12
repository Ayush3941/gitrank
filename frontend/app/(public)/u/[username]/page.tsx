import { PublicProfilePageClient } from "@/features/profile/components/PublicProfilePageClient";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PublicProfilePageClient username={username} />;
}
