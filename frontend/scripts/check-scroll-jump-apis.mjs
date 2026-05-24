import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features", "hooks"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
const allowMarker = "gitrank-allow-scroll-api";
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Scroll-jump API guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    `Use state-driven routing/selection instead of direct scroll APIs. If a case is required, document it with "${allowMarker}".`,
  );
  process.exit(1);
}

console.log("Scroll-jump API guard passed");

function walk(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) return;

  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      if (ignoredDirs.has(child)) continue;
      walk(path.join(entry, child));
    }
    return;
  }

  if (!/\.[cm]?[jt]sx?$/.test(entry)) return;

  const relative = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");

  if (source.includes(allowMarker)) {
    return;
  }

  const patterns = [
    /\bwindow\.scrollTo\s*\(/,
    /\bwindow\.scrollBy\s*\(/,
    /\bscrollIntoView\s*\(/,
    /\bdocument\.documentElement\.scrollTop\b/,
    /\bdocument\.body\.scrollTop\b/,
  ];

  for (const pattern of patterns) {
    if (pattern.test(source)) {
      violations.push(`${relative}: avoid direct scroll API ${pattern}`);
      break;
    }
  }
}
