import { AppShell } from "@/components/shared/AppShell";
import { PRBattleReportPageClient } from "@/features/pr-report/components/PRBattleReportPageClient";

export default async function PRBattleReportPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; number: string }>;
}) {
  const { owner, repo, number } = await params;

  return (
    <AppShell className="max-w-6xl">
      <PRBattleReportPageClient owner={owner} repo={repo} number={Number(number)} />
    </AppShell>
  );
}
