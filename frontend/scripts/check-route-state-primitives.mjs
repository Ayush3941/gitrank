import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appRoot = path.join(root, "app");
const routeStateContracts = new Map([
  ["loading.tsx", "RouteLoadingState"],
  ["not-found.tsx", "RouteFallbackCard"],
  ["error.tsx", "RouteErrorCard"],
  ["global-error.tsx", "RouteErrorCard"],
]);
const violations = [];

walk(appRoot);

if (violations.length > 0) {
  console.error("Route state primitive check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Route loading, error, and not-found files must use shared route-state primitives for consistent UI and accessibility.",
  );
  process.exit(1);
}

console.log("Route state primitive check passed");

function walk(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) {
    return;
  }
  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      walk(path.join(entry, child));
    }
    return;
  }

  const basename = path.basename(entry);
  const expectedPrimitive = routeStateContracts.get(basename);
  if (!expectedPrimitive) {
    return;
  }

  const relative = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");
  if (!source.includes(expectedPrimitive)) {
    violations.push(`${relative} must render ${expectedPrimitive}`);
  }
}
