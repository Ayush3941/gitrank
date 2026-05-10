import { ContributionsPageClient } from "@/features/contributions/components/ContributionsPageClient";
import { getPreviewMode } from "@/lib/preview";

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const preview = getPreviewMode((await searchParams).demo);
  return <ContributionsPageClient preview={preview} />;
}
