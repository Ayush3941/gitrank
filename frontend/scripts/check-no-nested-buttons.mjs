import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Nested button guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Do not nest <button> elements. Use a single interactive root or asChild patterns.",
  );
  process.exit(1);
}

console.log("Nested button guard passed");

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
  scanForNestedButtons(relative, source);
}

function scanForNestedButtons(relativePath, source) {
  const regex = /<\/?button\b[^>]*>/gi;
  const stack = [];

  for (const match of source.matchAll(regex)) {
    const token = match[0] ?? "";
    const index = match.index ?? 0;
    const isClose = token.startsWith("</");
    const isSelfClosing = token.endsWith("/>");
    const line = source.slice(0, index).split("\n").length;

    if (isClose) {
      if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }

    if (stack.length > 0) {
      const parentLine = stack[stack.length - 1];
      violations.push(
        `${relativePath}:${line} has <button> nested inside another <button> (parent line ${parentLine})`,
      );
      continue;
    }

    if (!isSelfClosing) {
      stack.push(line);
    }
  }
}
