import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features", "hooks", "lib"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
const bannedRadiusPattern =
  /\brounded-(?!(?:full|none|\[var\(--radius-universal\)\]))(?:[A-Za-z0-9]+|\[[^\]]+\])/g;

const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Radius token policy guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Radius token policy guard passed");

function walk(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) {
    return;
  }
  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      if (ignoredDirs.has(child)) {
        continue;
      }
      walk(path.join(entry, child));
    }
    return;
  }
  if (!/\.[cm]?[jt]sx?$/.test(entry)) {
    return;
  }

  const relative = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    const matches = [...line.matchAll(bannedRadiusPattern)];
    for (const match of matches) {
      violations.push(
        `${relative}:${index + 1} uses ${match[0]}; use rounded-[var(--radius-universal)], rounded-full, or rounded-none`,
      );
    }
  });
}
