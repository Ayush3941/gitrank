import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const filterFiles = [
  "features/contributions/components/ContributionFilters.tsx",
  "features/leaderboard/components/LeaderboardPageClient.tsx",
  "features/quests/components/QuestsCadenceControls.tsx",
  "features/badges/components/BadgesShelfControls.tsx",
  "features/settings/components/SyncRunActivityFilters.tsx",
  "features/settings/components/PrivacyRepositoryToggleList.tsx",
];

const staleNameFiles = [
  "components",
  "features",
  "tests",
];

const violations = [];

for (const relativePath of filterFiles) {
  const absolutePath = path.join(root, relativePath);
  const source = readFileSync(absolutePath, "utf8");

  if (!source.includes("SegmentedControl")) {
    violations.push(`${relativePath}: expected SegmentedControl usage for filter controls`);
  }

  if (/SegmentedTablist|segmented-tablist|tablist-keyboard|aria-selected/.test(source)) {
    violations.push(`${relativePath}: found stale segmented tablist naming or selection state`);
  }

  if (/<select\b/i.test(source)) {
    violations.push(
      `${relativePath}: found <select>; use segmented controls for dashboard filter consistency`,
    );
  }

  const segmentedInvocations = source.match(/<SegmentedControl[\s\S]*?\n\s*\/>/g) ?? [];
  for (const invocation of segmentedInvocations) {
    if (!/\bwrap\b/.test(invocation)) {
      violations.push(
        `${relativePath}: SegmentedControl filter controls must set 'wrap' to avoid horizontal overflow`,
      );
      break;
    }
    if (!/\bariaControls=/.test(invocation)) {
      violations.push(
        `${relativePath}: SegmentedControl filter controls must set 'ariaControls' for result-region accessibility`,
      );
      break;
    }
  }
}

for (const relativePath of staleNameFiles) {
  const absolutePath = path.join(root, relativePath);
  scanForStaleNames(absolutePath, relativePath);
}

if (violations.length > 0) {
  console.error("Segmented filter consistency check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Segmented filter consistency check passed");

function scanForStaleNames(directory, relativeDirectory) {
  for (const entry of readdirSync(directory)) {
    const absolutePath = path.join(directory, entry);
    const relativePath = path.join(relativeDirectory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      scanForStaleNames(absolutePath, relativePath);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry)) {
      continue;
    }
    const source = readFileSync(absolutePath, "utf8");
    if (/SegmentedTablist|segmented-tablist|tablist-keyboard|laneTabs/.test(source)) {
      violations.push(`${relativePath}: found stale segmented tablist naming`);
    }
  }
}
