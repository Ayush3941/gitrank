import { SettingsPageClient } from "@/features/settings/components/SettingsPageClient";
import { getPreviewMode } from "@/lib/preview";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const preview = getPreviewMode((await searchParams).demo);
  return <SettingsPageClient preview={preview} />;
}
