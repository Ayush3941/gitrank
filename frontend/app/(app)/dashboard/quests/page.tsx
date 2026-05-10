import { QuestsPageClient } from "@/features/quests/components/QuestsPageClient";
import { getPreviewMode } from "@/lib/preview";

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const preview = getPreviewMode((await searchParams).demo);
  return <QuestsPageClient preview={preview} />;
}
