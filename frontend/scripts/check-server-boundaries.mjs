import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const serverOnlyModules = [
  "lib/api/auth-server.ts",
  "lib/api/gateway-server.ts",
  "lib/ai/abra-insights.ts",
];
const blockedClientImportFragments = [
  "@/lib/api/auth-server",
  "@/lib/api/gateway-server",
  "@/lib/ai/abra-insights",
];
const scanRoots = ["app", "components", "features", "hooks", "lib"];
const violations = [];

for (const modulePath of serverOnlyModules) {
  const absolute = path.join(root, modulePath);
  const source = readFileSync(absolute, "utf8");
  if (!source.includes(`import "server-only";`) && !source.includes(`import 'server-only';`)) {
    violations.push(`${modulePath}: missing import "server-only";`);
  }
}

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Server-boundary verification failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Server-boundary verification passed");

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
  const relative = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");
  const clientScoped =
    relative.startsWith("components/") ||
    relative.startsWith("features/") ||
    relative.startsWith("hooks/") ||
    source.includes('"use client"') ||
    source.includes("'use client'");

  if (!clientScoped) return;
  for (const blockedImport of blockedClientImportFragments) {
    const importRegex = new RegExp(`['"]${escapeRegExp(blockedImport)}['"]`);
    if (importRegex.test(source)) {
      violations.push(`${relative}: client scope imports server-only module (${blockedImport})`);
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
