import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features", "hooks", "lib"];
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Main-thread guard check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Main-thread guard check passed");

function walk(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) return;

  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      if (child === "node_modules" || child === ".next" || child === "dist") continue;
      walk(path.join(entry, child));
    }
    return;
  }

  if (!/\.[cm]?[jt]sx?$/.test(entry)) return;
  if (entry.includes(`${path.sep}tests${path.sep}`)) return;
  const relative = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");
  const clientScoped =
    relative.startsWith("components/") ||
    relative.startsWith("features/") ||
    relative.startsWith("hooks/") ||
    source.includes('"use client"') ||
    source.includes("'use client'");
  if (!clientScoped) return;

  if (/requestAnimationFrame\s*\(/.test(source)) {
    violations.push(`${relative}: avoid requestAnimationFrame loops on product routes unless justified`);
  }
  if (/for\s*\(\s*;\s*;\s*\)/.test(source) || /while\s*\(\s*true\s*\)/.test(source)) {
    violations.push(`${relative}: infinite loop pattern detected in client scope`);
  }

  const intervalRegex = /setInterval\s*\(\s*[\s\S]*?,\s*([0-9_]+)\s*\)/g;
  for (const match of source.matchAll(intervalRegex)) {
    const raw = (match[1] ?? "").replace(/_/g, "");
    const intervalMs = Number(raw);
    if (!Number.isFinite(intervalMs)) {
      continue;
    }
    if (intervalMs < 4000) {
      violations.push(`${relative}: setInterval below 4000ms (${intervalMs}ms) is too aggressive`);
    }
  }
}
