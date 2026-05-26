#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const targets = [
  "features/dashboard/components/DashboardPageClient.tsx",
  "features/contributions/components/ContributionsPageClient.tsx",
  "features/badges/components/BadgesPageClient.tsx",
  "features/quests/components/QuestsPageClient.tsx",
  "features/leaderboard/components/LeaderboardPageClient.tsx",
];

const failures = [];

for (const relativePath of targets) {
  const absolutePath = path.join(root, relativePath);
  const source = await readFile(absolutePath, "utf8");

  assertPattern(
    source,
    relativePath,
    /useRunUserSync/,
    "missing useRunUserSync import",
  );
  assertPattern(
    source,
    relativePath,
    /const\s+runUserSync\s*=\s*useRunUserSync\(\)/,
    "missing runUserSync hook initialization",
  );
  assertPattern(
    source,
    relativePath,
    /<StaleState[\s\S]*onRefresh=\{\(\)\s*=>\s*\{[\s\S]*runUserSync\.mutateAsync\(/,
    "stale refresh action does not trigger runUserSync.mutateAsync(...)",
  );
}

if (failures.length > 0) {
  console.error("Stale refresh sync wiring check failed:");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.reason}`);
  }
  process.exit(1);
}

console.log("Stale refresh sync wiring check passed");

function assertPattern(source, file, pattern, reason) {
  if (pattern.test(source)) {
    return;
  }
  failures.push({ file, reason });
}

