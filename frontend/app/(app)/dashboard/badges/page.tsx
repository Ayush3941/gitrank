import { BadgesPageClient } from "@/features/badges/components/BadgesPageClient";
import { getPreviewMode } from "@/lib/preview";

export default async function BadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const preview = getPreviewMode((await searchParams).demo);
  return <BadgesPageClient preview={preview} />;
}
