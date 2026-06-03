import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features", "hooks"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
const allowedFiles = new Set(["components/shared/focus-without-scroll.ts"]);
const allowMarker = "gitrank-allow-raw-focus";
const rawFocusPattern = /\??\.\s*focus\s*\(/;
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Focus-without-scroll guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    `Use focusWithoutScroll() instead of raw .focus() so pointer/clear actions do not jump the viewport. If a case is required, document it with "${allowMarker}".`,
  );
  process.exit(1);
}

console.log("Focus-without-scroll guard passed");

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
  if (allowedFiles.has(relative)) {
    return;
  }

  const source = readFileSync(entry, "utf8");
  if (!rawFocusPattern.test(source) || source.includes(allowMarker)) {
    return;
  }

  violations.push(`${relative}: use focusWithoutScroll() instead of raw .focus()`);
}
