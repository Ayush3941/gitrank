import { DashboardPageClient } from "@/features/dashboard/components/DashboardPageClient";
import { getPreviewMode } from "@/lib/preview";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const preview = getPreviewMode((await searchParams).demo);
  return <DashboardPageClient preview={preview} />;
}
