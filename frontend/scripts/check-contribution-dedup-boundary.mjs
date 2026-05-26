#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features", "hooks", "lib"];
const scanExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const excludedSegments = new Set([
  "__tests__",
  "tests",
  "test",
  "docs",
  "scripts",
  "node_modules",
]);
const boundaryModule = path.normalize("lib/presentation/contribution-dedup.ts");
const violations = [];

for (const relativeRoot of scanRoots) {
  await walk(path.join(root, relativeRoot));
}

if (violations.length > 0) {
  console.error("Contribution dedup boundary guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.reason}`);
  }
  console.error(
    `Only ${boundaryModule} may define contribution deduplication functions.`,
  );
  process.exit(1);
}

console.log("Contribution dedup boundary guard passed");

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
    const relativePath = path.relative(root, absolutePath);
    if (path.normalize(relativePath) === boundaryModule) {
      continue;
    }
    const source = await readFile(absolutePath, "utf8");
    checkViolations(relativePath, source);
  }
}

function checkViolations(file, source) {
  const checks = [
    {
      reason: "duplicate contribution dedup function declaration",
      pattern: /function\s+deduplicateContributions(?:ByPR|ByPullRequest)?\s*\(/g,
    },
    {
      reason: "duplicate contribution dedup key helper declaration",
      pattern: /function\s+contributionKey\s*\(\s*row:\s*Contribution/g,
    },
  ];

  for (const check of checks) {
    let match;
    while ((match = check.pattern.exec(source)) !== null) {
      violations.push({
        file,
        reason: check.reason,
        line: lineFromOffset(source, match.index),
      });
    }
  }
}

function lineFromOffset(source, offset) {
  return source.slice(0, Math.max(0, offset)).split("\n").length;
}

