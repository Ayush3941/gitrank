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
const policyModule = path.normalize("lib/runtime/pr-category-policy.ts");

const violations = [];

for (const relativeRoot of scanRoots) {
  await walk(path.join(root, relativeRoot));
}

if (violations.length > 0) {
  console.error("PR category policy boundary guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.reason}`);
  }
  console.error(
    `Only ${policyModule} may declare PR category mapping rules or category-normalization policy.`,
  );
  process.exit(1);
}

console.log("PR category policy boundary guard passed");

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
    if (path.normalize(relativePath) === policyModule) {
      continue;
    }
    const source = await readFile(absolutePath, "utf8");
    checkViolations(relativePath, source);
  }
}

function checkViolations(file, source) {
  const checks = [
    {
      reason: "duplicate PR category map declaration",
      pattern: /Record<\s*string\s*,\s*PRCategory\s*>/g,
    },
    {
      reason: "deprecated category text-inference helper",
      pattern: /inferPRCategoryFromText\s*\(/g,
    },
    {
      reason: "duplicate normalizePRCategory function declaration",
      pattern: /function\s+normalizePRCategory\s*\(/g,
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

