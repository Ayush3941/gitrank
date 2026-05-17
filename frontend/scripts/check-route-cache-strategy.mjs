import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];

verifyRouteHandlers(path.join(root, "app", "api"));
verifyRouteHandlers(path.join(root, "app", "oauth"));
verifyNoStoreFetch(path.join(root, "lib", "api"));

if (violations.length > 0) {
  console.error("Route cache strategy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Route cache strategy check passed");

function verifyRouteHandlers(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) return;

  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      verifyRouteHandlers(path.join(entry, child));
    }
    return;
  }

  if (!entry.endsWith("route.ts")) return;
  const relative = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");
  if (!source.includes(`export const dynamic = "force-dynamic"`)) {
    violations.push(`${relative}: route handler must export dynamic = "force-dynamic"`);
  }
}

function verifyNoStoreFetch(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) return;

  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      verifyNoStoreFetch(path.join(entry, child));
    }
    return;
  }

  if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) return;
  const relative = path.relative(root, entry).split(path.sep).join("/");
  if (!relative.startsWith("lib/api/")) return;

  const source = readFileSync(entry, "utf8");
  const hasFetch = source.includes("fetch(");
  if (!hasFetch) return;
  if (!source.includes(`cache: "no-store"`)) {
    violations.push(`${relative}: fetch usage is missing cache: "no-store"`);
  }
}
