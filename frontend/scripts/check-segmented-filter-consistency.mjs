import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const filterFiles = [
  "features/contributions/components/ContributionFilters.tsx",
  "features/leaderboard/components/LeaderboardPageClient.tsx",
  "features/quests/components/QuestsPageClient.tsx",
  "features/badges/components/BadgesPageClient.tsx",
  "features/settings/components/SyncRunActivityPanel.tsx",
  "features/settings/components/PrivacyRepositoryToggleList.tsx",
];

const violations = [];

for (const relativePath of filterFiles) {
  const absolutePath = path.join(root, relativePath);
  const source = readFileSync(absolutePath, "utf8");

  if (!source.includes("SegmentedTablist")) {
    violations.push(`${relativePath}: expected SegmentedTablist usage for filter controls`);
  }

  if (/<select\b/i.test(source)) {
    violations.push(
      `${relativePath}: found <select>; use segmented controls for dashboard filter consistency`,
    );
  }
}

if (violations.length > 0) {
  console.error("Segmented filter consistency check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Segmented filter consistency check passed");
