#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = [
  "features/onboarding",
  "features/marketing",
  "components/shared/MarketingLayout.tsx",
];
const scanExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const excludedSegments = new Set([
  "__tests__",
  "tests",
  "test",
  "docs",
  "scripts",
  "node_modules",
]);

const violations = [];

for (const relativeTarget of scanRoots) {
  const absoluteTarget = path.join(root, relativeTarget);
  await walk(absoluteTarget);
}

if (violations.length > 0) {
  console.error("Onboarding/marketing prefetch policy check failed:");
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} -> ${violation.snippet}`,
    );
  }
  console.error(
    "Add prefetch={false} to non-critical onboarding/marketing internal links.",
  );
  process.exit(1);
}

console.log("Onboarding/marketing prefetch policy check passed");

async function walk(targetPath) {
  let statEntries = [];
  try {
    statEntries = await readdir(targetPath, { withFileTypes: true });
  } catch {
    // single-file target or missing path
    await scanFile(targetPath);
    return;
  }

  for (const entry of statEntries) {
    const absolutePath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      if (excludedSegments.has(entry.name)) {
        continue;
      }
      await walk(absolutePath);
      continue;
    }
    await scanFile(absolutePath);
  }
}

async function scanFile(absolutePath) {
  const extension = path.extname(absolutePath);
  if (!scanExtensions.has(extension)) {
    return;
  }

  let source = "";
  try {
    source = await readFile(absolutePath, "utf8");
  } catch {
    return;
  }

  const relativePath = path.relative(root, absolutePath);
  const linkPattern = /<Link\b[^>]*>/g;
  let match = linkPattern.exec(source);
  while (match) {
    const snippet = (match[0] ?? "").replace(/\s+/g, " ").trim();
    if (
      /href=\{?["']\//.test(snippet) &&
      !/prefetch=\{false\}/.test(snippet)
    ) {
      violations.push({
        file: relativePath,
        line: lineFromOffset(source, match.index ?? 0),
        snippet,
      });
    }
    match = linkPattern.exec(source);
  }
}

function lineFromOffset(source, offset) {
  return source.slice(0, Math.max(0, offset)).split("\n").length;
}
