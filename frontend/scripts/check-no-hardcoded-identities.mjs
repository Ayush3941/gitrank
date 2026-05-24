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

const bannedIdentities = [
  "ayush3941",
  "ayush kumar gaur",
  "octocat",
];

const violations = [];

for (const relativeRoot of scanRoots) {
  await walk(path.join(root, relativeRoot));
}

if (violations.length > 0) {
  console.error("Hardcoded identity guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.identity}`);
  }
  console.error(
    "Production UI code must not contain personal/demo identities. Use live authenticated data instead.",
  );
  process.exit(1);
}

console.log("Hardcoded identity guard passed");

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
    const lowerSource = source.toLowerCase();
    for (const identity of bannedIdentities) {
      const index = lowerSource.indexOf(identity);
      if (index === -1) {
        continue;
      }
      violations.push({
        file: relativePath,
        identity,
        line: lineFromOffset(source, index),
      });
    }
  }
}

function lineFromOffset(source, offset) {
  return source.slice(0, Math.max(0, offset)).split("\n").length;
}
