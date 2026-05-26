#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features"];
const includeExt = new Set([".tsx"]);
const idPattern = /\bid\s*=\s*(?:\{\s*)?(["'])([A-Za-z0-9_-]+)\1(?:\s*\})?/g;

const duplicates = [];

for (const relRoot of scanRoots) {
  const absRoot = path.join(root, relRoot);
  await walk(absRoot);
}

if (duplicates.length > 0) {
  console.error("Duplicate literal JSX ids detected:");
  for (const dup of duplicates) {
    console.error(`- ${dup.file}: id="${dup.id}" appears ${dup.count} times`);
  }
  console.error(
    "Use one stable container id per region (or unique ids) to avoid accessibility/anchor collisions.",
  );
  process.exit(1);
}

console.log("Duplicate literal JSX id check passed");

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

    const fileStat = await stat(abs);
    if (!fileStat.isFile()) {
      continue;
    }

    const source = await readFile(abs, "utf8");
    const counts = new Map();

    let match = idPattern.exec(source);
    while (match) {
      const id = match[2];
      counts.set(id, (counts.get(id) ?? 0) + 1);
      match = idPattern.exec(source);
    }

    for (const [id, count] of counts) {
      if (count > 1) {
        duplicates.push({
          file: path.relative(root, abs),
          id,
          count,
        });
      }
    }
  }
}
