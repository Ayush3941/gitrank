import { PublicProfilePageClient } from "@/features/profile/components/PublicProfilePageClient";
import { getPreviewMode } from "@/lib/preview";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { username } = await params;
  const preview = getPreviewMode((await searchParams).demo);
  return <PublicProfilePageClient username={username} preview={preview} />;
}
