import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "hooks", "features", "lib/api"];
const blockedImports = [
  "@/lib/api/mock-api",
  "@/lib/demo/mock-api",
  "@/lib/mock-data/gitrank",
];

const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Production frontend modules must not import mock data directly.");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.importPath}`);
  }
  console.error("Move preview-only mock access behind frontend/lib/demo/preview-api.ts.");
  process.exit(1);
}

function walk(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) return;

  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      if (child === "node_modules" || child === ".next") continue;
      walk(path.join(entry, child));
    }
    return;
  }

  if (!/\.[cm]?[jt]sx?$/.test(entry)) return;

  const relative = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");
  for (const importPath of blockedImports) {
    if (source.includes(importPath)) {
      violations.push({ file: relative, importPath });
    }
  }
}
