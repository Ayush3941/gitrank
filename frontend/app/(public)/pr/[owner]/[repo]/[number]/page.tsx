import type { Metadata } from "next";
import { AppShell } from "@/components/shared/AppShell";
import { PRBattleReportPageClient } from "@/features/pr-report/components/PRBattleReportPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string; number: string }>;
}): Promise<Metadata> {
  const { owner, repo, number } = await params;
  return {
    title: `${owner}/${repo} #${number}`,
    description:
      "GitRank pull-request battle report with score drivers, strengths, and evidence-backed recommendations.",
  };
}

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
