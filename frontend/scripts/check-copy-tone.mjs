#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features", "hooks", "lib"];
const scanExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const excludedSegments = new Set([
  "__tests__",
  "tests",
  "test",
  "docs",
  "scripts",
  "node_modules",
]);

const bannedPhrases = [
  "could not be loaded",
  "could not load",
  "is not available in this snapshot yet",
  "has not earned a public gitrank score yet",
  "command center",
  "quick actions",
  "low-cpu device mode",
  "theme: midnight",
  "text: large",
  "report metadata:",
  "snapshot-based contribution analytics",
];

const bannedPatterns = [
  {
    regex: /loading\s+[^"`'\n]*\.\.\./i,
    label: "loading copy with trailing ellipses",
  },
];

const allowList = new Set([
  "features/pr-report/components/PRBattleReportPageClient.tsx::analysis has not been persisted",
]);

const violations = [];

for (const relativeRoot of scanRoots) {
  await walk(path.join(root, relativeRoot));
}

if (violations.length > 0) {
  console.error("Copy tone check failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> contains "${violation.phrase}"`);
  }
  console.error(
    "Use conversational positive phrasing (e.g. 'is unavailable right now' or 'will appear after sync').",
  );
  process.exit(1);
}

console.log("Copy tone check passed");

async function walk(directory) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (excludedSegments.has(entry.name)) {
        continue;
      }
      await walk(absolutePath);
      continue;
    }
    if (!entry.isFile() || !scanExtensions.has(path.extname(entry.name))) {
      continue;
    }
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    const source = await readFile(absolutePath, "utf8");
    const normalized = source.toLowerCase();
    for (const phrase of bannedPhrases) {
      const index = normalized.indexOf(phrase);
      if (index === -1) {
        continue;
      }
      const allowKey = `${relativePath}::${phrase}`;
      if (allowList.has(allowKey)) {
        continue;
      }
      violations.push({
        file: relativePath,
        phrase,
        line: lineFromOffset(source, index),
      });
    }
    for (const pattern of bannedPatterns) {
      const match = source.match(pattern.regex);
      if (!match || match.index === undefined) {
        continue;
      }
      violations.push({
        file: relativePath,
        phrase: pattern.label,
        line: lineFromOffset(source, match.index),
      });
    }
  }
}

function lineFromOffset(source, offset) {
  return source.slice(0, Math.max(0, offset)).split("\n").length;
}
