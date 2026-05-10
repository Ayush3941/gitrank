import { AppShell } from "@/components/shared/AppShell";
import { PRBattleReportPageClient } from "@/features/pr-report/components/PRBattleReportPageClient";
import { getPreviewMode } from "@/lib/preview";

export default async function PRBattleReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; repo: string; number: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { owner, repo, number } = await params;
  const preview = getPreviewMode((await searchParams).demo);

  return (
    <AppShell className="max-w-6xl">
      <PRBattleReportPageClient owner={owner} repo={repo} number={Number(number)} preview={preview} />
    </AppShell>
  );
}
