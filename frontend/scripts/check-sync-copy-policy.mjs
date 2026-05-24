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
  "run sync",
  "run a sync",
  "run a full sync",
  "sync now",
];

const violations = [];

for (const relativeRoot of scanRoots) {
  await walk(path.join(root, relativeRoot));
}

if (violations.length > 0) {
  console.error("Sync copy policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> contains "${violation.phrase}"`);
  }
  console.error(
    'Use auto-sync model language such as "Open sync settings" instead of manual "run sync" phrasing.',
  );
  process.exit(1);
}

console.log("Sync copy policy check passed");

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
    const source = await readFile(absolutePath, "utf8");
    const normalized = source.toLowerCase();
    for (const phrase of bannedPhrases) {
      const index = normalized.indexOf(phrase);
      if (index === -1) {
        continue;
      }
      violations.push({
        file: relativePath,
        phrase,
        line: lineFromOffset(source, index),
      });
    }
  }
}

function lineFromOffset(source, offset) {
  return source.slice(0, Math.max(0, offset)).split("\n").length;
}
