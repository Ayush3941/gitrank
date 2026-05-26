import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const manifestPath = path.join(nextDir, "build-manifest.json");

const budgets = {
  rootMainTotalBytes: 700 * 1024,
  largestRootMainChunkBytes: 300 * 1024,
  polyfillsTotalBytes: 150 * 1024,
};

const strictManifestRequirement = process.env.STRICT_PERF_BUDGET_MANIFEST === "1";

if (!existsSync(manifestPath)) {
  const message = `Skipping performance budget check: missing ${manifestPath}. Run \`npm --prefix frontend run build\` first.`;
  if (strictManifestRequirement) {
    console.error(message);
    process.exit(1);
  }
  console.log(message);
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const rootMainFiles = manifest.rootMainFiles ?? [];
const polyfillFiles = manifest.polyfillFiles ?? [];

const rootMainSizes = rootMainFiles.map((file) => ({
  file,
  size: fileSize(path.join(nextDir, file)),
}));
const polyfillSizes = polyfillFiles.map((file) => ({
  file,
  size: fileSize(path.join(nextDir, file)),
}));

const rootMainTotal = rootMainSizes.reduce((sum, item) => sum + item.size, 0);
const largestRootMain = rootMainSizes.reduce((max, item) => Math.max(max, item.size), 0);
const polyfillTotal = polyfillSizes.reduce((sum, item) => sum + item.size, 0);

const violations = [];

if (rootMainTotal > budgets.rootMainTotalBytes) {
  violations.push(
    `rootMain total ${formatBytes(rootMainTotal)} exceeds budget ${formatBytes(budgets.rootMainTotalBytes)}`,
  );
}
if (largestRootMain > budgets.largestRootMainChunkBytes) {
  violations.push(
    `largest rootMain chunk ${formatBytes(largestRootMain)} exceeds budget ${formatBytes(
      budgets.largestRootMainChunkBytes,
    )}`,
  );
}
if (polyfillTotal > budgets.polyfillsTotalBytes) {
  violations.push(
    `polyfill total ${formatBytes(polyfillTotal)} exceeds budget ${formatBytes(
      budgets.polyfillsTotalBytes,
    )}`,
  );
}

console.log(
  [
    `rootMain total: ${formatBytes(rootMainTotal)}`,
    `largest rootMain chunk: ${formatBytes(largestRootMain)}`,
    `polyfills total: ${formatBytes(polyfillTotal)}`,
  ].join(" | "),
);

if (violations.length > 0) {
  console.error("Performance budget check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

function fileSize(filePath) {
  return statSync(filePath).size;
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)}KB`;
}
