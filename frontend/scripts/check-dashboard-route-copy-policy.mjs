#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const routeContracts = [
  {
    file: "app/(app)/dashboard/page.tsx",
    href: "/dashboard",
  },
  {
    file: "app/(app)/dashboard/contributions/page.tsx",
    href: "/dashboard/contributions",
  },
  {
    file: "app/(app)/dashboard/badges/page.tsx",
    href: "/dashboard/badges",
  },
  {
    file: "app/(app)/dashboard/quests/page.tsx",
    href: "/dashboard/quests",
  },
  {
    file: "app/(app)/dashboard/settings/page.tsx",
    href: "/dashboard/settings",
  },
];

const violations = [];

for (const contract of routeContracts) {
  const absolutePath = path.join(root, contract.file);
  let source = "";
  try {
    source = await readFile(absolutePath, "utf8");
  } catch (error) {
    violations.push({
      file: contract.file,
      reason: `Could not read file: ${error instanceof Error ? error.message : "unknown error"}`,
    });
    continue;
  }

  const requiredPatterns = [
    {
      regex: /import\s*\{\s*dashboardNavByHref\s*\}\s*from\s*["']@\/components\/shared\/dashboard-nav["'];?/,
      reason: "must import dashboardNavByHref from shared dashboard-nav copy source",
    },
    {
      regex: new RegExp(
        String.raw`const\s+routeCopy\s*=\s*dashboardNavByHref\[\s*["']${escapeRegExp(contract.href)}["']\s*\]`,
      ),
      reason: `must resolve routeCopy from dashboardNavByHref["${contract.href}"]`,
    },
    {
      regex: /title:\s*routeCopy\.label/,
      reason: "metadata title must come from routeCopy.label",
    },
    {
      regex: /description:\s*routeCopy\.metaDescription/,
      reason: "metadata description must come from routeCopy.metaDescription",
    },
  ];

  for (const pattern of requiredPatterns) {
    if (!pattern.regex.test(source)) {
      violations.push({
        file: contract.file,
        reason: pattern.reason,
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Dashboard route copy policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.reason}`);
  }
  process.exit(1);
}

console.log("Dashboard route copy policy check passed");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
