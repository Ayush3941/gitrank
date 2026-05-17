import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const buildManifestPath = path.join(nextDir, "build-manifest.json");

const manifest = JSON.parse(readFileSync(buildManifestPath, "utf8"));
const files = new Set([
  ...(manifest.rootMainFiles ?? []),
  ...(manifest.polyfillFiles ?? []),
  ...Object.values(manifest.pages ?? {}).flat(),
]);

const rows = [...files]
  .filter((file) => file.endsWith(".js"))
  .map((file) => ({
    file,
    size: statSync(path.join(nextDir, file)).size,
  }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 12);

console.log("Top client JS assets by size:");
for (const row of rows) {
  console.log(`- ${row.file}: ${formatKB(row.size)}KB`);
}

const packageJSON = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJSON.dependencies?.motion) {
  console.error("Bundle analysis failed: unused dependency 'motion' is still present.");
  process.exit(1);
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(1);
}
