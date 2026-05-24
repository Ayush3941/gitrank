#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["components", "features"];
const includeExt = new Set([".tsx"]);

const directKeyPattern = /key=\{\s*([A-Za-z_$][\w$.]*)\s*\}/g;
const riskyTokens = [
  "label",
  "name",
  "category",
  "skill",
  "signal",
  "point",
  "entry",
  "change",
  "repo",
  "title",
];

const violations = [];

for (const relRoot of scanRoots) {
  const absRoot = path.join(root, relRoot);
  await walk(absRoot);
}

if (violations.length > 0) {
  console.error("Potentially unstable JSX key patterns detected:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.snippet}`);
  }
  console.error(
    "Use stable unique identifiers (id/owner+repo+number/etc.) or compound keys to avoid duplicate-key render bugs.",
  );
  process.exit(1);
}

console.log("Unstable JSX key check passed");

async function walk(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(abs);
      continue;
    }
    if (!entry.isFile() || !includeExt.has(path.extname(entry.name))) {
      continue;
    }
    const source = await readFile(abs, "utf8");
    const relative = path.relative(root, abs);
    let match = directKeyPattern.exec(source);
    while (match) {
      const expression = (match[1] ?? "").trim();
      const snippet = (match[0] ?? "").trim();
      const normalized = expression.toLowerCase();
      const hasStabilityHint =
        normalized.includes(".id") ||
        normalized.includes("item.href") ||
        normalized.includes("item.value") ||
        normalized.includes("step.key") ||
        normalized.includes("datekey");
      const hasRiskyToken = riskyTokens.some((token) => normalized.includes(token));

      if (hasRiskyToken && !hasStabilityHint) {
        const line = lineFromOffset(source, match.index ?? 0);
        violations.push({
          file: relative,
          line,
          snippet,
        });
      }

      match = directKeyPattern.exec(source);
    }
  }
}

function lineFromOffset(source, offset) {
  return source.slice(0, offset).split("\n").length;
}
