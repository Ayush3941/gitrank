import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features", "hooks", "lib"];
const ignoredPathSegments = ["/app/api/", "/lib/ai/", "/lib/api/gateway-server", "/lib/api/auth-server"];
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Unsafe environment usage in client-exposed frontend modules:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.message}`);
  }
  process.exit(1);
}

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
  if (ignoredPathSegments.some((segment) => relative.includes(segment))) return;

  const source = readFileSync(entry, "utf8");
  const clientScoped =
    relative.startsWith("components/") ||
    relative.startsWith("features/") ||
    relative.startsWith("hooks/") ||
    source.includes('"use client"') ||
    source.includes("'use client'");

  if (!clientScoped) return;

  const envMatches = source.match(/process\.env\.([A-Z0-9_]+)/g) ?? [];
  for (const match of envMatches) {
    const key = match.split(".").at(-1) ?? "";
    if (!key.startsWith("NEXT_PUBLIC_")) {
      violations.push({
        file: relative,
        message: `non-public env key in client scope (${key})`,
      });
    }
  }
}
