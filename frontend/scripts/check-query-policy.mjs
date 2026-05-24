import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const policyChecks = [
  {
    file: "components/providers/query-provider.tsx",
    required: [
      /refetchOnWindowFocus:\s*false/,
      /retry:\s*false/,
    ],
  },
  {
    file: "hooks/use-dashboard.ts",
    required: [
      /useQuery\(\{[\s\S]*retry:\s*false/,
      /useQuery\(\{[\s\S]*refetchOnWindowFocus:\s*false/,
    ],
  },
  {
    file: "hooks/use-contributions.ts",
    required: [
      /useQuery<[\s\S]*>\(\{[\s\S]*retry:\s*false/,
      /useQuery<[\s\S]*>\(\{[\s\S]*refetchOnWindowFocus:\s*false/,
    ],
  },
  {
    file: "hooks/use-badges.ts",
    required: [
      /useQuery<BadgesQueryData>\(\{[\s\S]*retry:\s*false/,
      /useQuery<BadgesQueryData>\(\{[\s\S]*refetchOnWindowFocus:\s*false/,
    ],
  },
  {
    file: "hooks/use-sync-runs.ts",
    required: [
      /useQuery\(\{[\s\S]*retry:\s*false/,
      /useQuery\(\{[\s\S]*refetchOnWindowFocus:\s*false/,
    ],
  },
  {
    file: "hooks/use-profile.ts",
    required: [
      /useQuery\(\{[\s\S]*queryKey:\s*\["profile",\s*"public",\s*username\][\s\S]*retry:\s*false/,
      /useQuery\(\{[\s\S]*queryKey:\s*myProfileQueryKey[\s\S]*retry:\s*false/,
    ],
  },
  {
    file: "hooks/use-leaderboard.ts",
    required: [
      /useQuery\(\{[\s\S]*retry:\s*false/,
      /useQuery\(\{[\s\S]*refetchOnWindowFocus:\s*false/,
    ],
  },
  {
    file: "hooks/use-quests.ts",
    required: [
      /useQuery<QuestsQueryData>\(\{[\s\S]*retry:\s*false/,
      /useQuery<QuestsQueryData>\(\{[\s\S]*refetchOnWindowFocus:\s*false/,
    ],
  },
  {
    file: "hooks/use-pr-report.ts",
    required: [
      /useQuery\(\{[\s\S]*retry:\s*false/,
      /useQuery\(\{[\s\S]*refetchOnWindowFocus:\s*false/,
    ],
  },
  {
    file: "hooks/use-abra-insights.ts",
    required: [/useQuery\(\{[\s\S]*retry:\s*false/],
  },
];

const violations = [];

for (const check of policyChecks) {
  const targetPath = path.join(root, check.file);
  let source = "";
  try {
    source = readFileSync(targetPath, "utf8");
  } catch (error) {
    violations.push(`${check.file}: could not read file (${String(error)})`);
    continue;
  }

  for (const pattern of check.required) {
    if (!pattern.test(source)) {
      violations.push(`${check.file}: missing policy pattern ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Query policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Query policy check passed");
