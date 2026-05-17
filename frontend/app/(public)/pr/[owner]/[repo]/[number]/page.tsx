import type { Metadata } from "next";
import { AppShell } from "@/components/shared/AppShell";
import { JsonLdScript } from "@/components/shared/JsonLdScript";
import { PRBattleReportPageClient } from "@/features/pr-report/components/PRBattleReportPageClient";
import { absolutePublicURL } from "@/lib/seo/public-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string; number: string }>;
}): Promise<Metadata> {
  const { owner, repo, number } = await params;
  const path = `/pr/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(number)}`;
  const url = absolutePublicURL(path);
  const ogPath = `${path}/opengraph-image`;
  const twitterPath = `${path}/twitter-image`;
  return {
    title: `${owner}/${repo} #${number}`,
    description:
      "GitRank pull-request battle report with score drivers, strengths, and evidence-backed recommendations.",
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${owner}/${repo} #${number} on GitRank`,
      description:
        "Evidence-backed pull request battle report with score drivers, review depth, and contribution signals.",
      url,
      images: [{ url: absolutePublicURL(ogPath) }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${owner}/${repo} #${number} on GitRank`,
      description:
        "Evidence-backed pull request battle report with score drivers, review depth, and contribution signals.",
      images: [absolutePublicURL(twitterPath)],
    },
  };
}

export default async function PRBattleReportPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; number: string }>;
}) {
  const { owner, repo, number } = await params;
  const path = `/pr/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(number)}`;
  const url = absolutePublicURL(path);
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const prUrl = `${repoUrl}/pull/${number}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `GitRank battle report for ${owner}/${repo} #${number}`,
    url,
    mainEntity: {
      "@type": "CreativeWork",
      name: `${owner}/${repo} #${number}`,
      url: prUrl,
      isPartOf: {
        "@type": "SoftwareSourceCode",
        name: `${owner}/${repo}`,
        codeRepository: repoUrl,
      },
    },
    isPartOf: {
      "@type": "WebSite",
      name: "GitRank",
      url: absolutePublicURL("/"),
    },
  };

  return (
    <AppShell className="max-w-6xl">
      <JsonLdScript id="public-pr-report-jsonld" data={jsonLd} />
      <PRBattleReportPageClient owner={owner} repo={repo} number={Number(number)} />
    </AppShell>
  );
}
