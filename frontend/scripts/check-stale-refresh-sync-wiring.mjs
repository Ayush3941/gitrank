#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const featuresRoot = path.join(root, "features");
const staleStateExemptions = new Set([
  // Public profile can be viewed anonymously; it should not attempt authenticated sync mutation.
  "features/profile/components/PublicProfilePageClient.tsx",
]);

const targets = await findStaleStateTargets(featuresRoot);

const failures = [];

for (const relativePath of targets) {
  const absolutePath = path.join(root, relativePath);
  const source = await readFile(absolutePath, "utf8");
  if (staleStateExemptions.has(relativePath)) {
    continue;
  }

  assertPattern(
    source,
    relativePath,
    /useRunUserSync/,
    "missing useRunUserSync import",
  );
  assertPattern(
    source,
    relativePath,
    /const\s+runUserSync\s*=\s*useRunUserSync\(\)/,
    "missing runUserSync hook initialization",
  );
  assertPattern(
    source,
    relativePath,
    /<StaleState/,
    "missing StaleState usage",
  );

  const hasInlineRefreshHandler = /<StaleState[\s\S]*onRefresh=\{(?:async\s*)?\(\)\s*=>\s*\{[\s\S]*runUserSync\.mutateAsync\(/.test(
    source,
  );
  const hasSharedRefreshHook = /useStaleSyncRefresh/.test(source);
  const hasSharedRefreshInitialization =
    /const\s+staleSyncRefresh\s*=\s*useStaleSyncRefresh\(\{[\s\S]*requestSync:\s*\(\)\s*=>\s*runUserSync\.mutateAsync\(\)[\s\S]*\}\)/.test(
      source,
    );
  const hasSharedRefreshWiring =
    /<StaleState[\s\S]*onRefresh=\{staleSyncRefresh\.onRefresh\}[\s\S]*isRefreshing=\{staleSyncRefresh\.isRefreshing\}/.test(
      source,
    );

  if (!hasInlineRefreshHandler && !(hasSharedRefreshHook && hasSharedRefreshInitialization && hasSharedRefreshWiring)) {
    failures.push({
      file: relativePath,
      reason:
        "stale refresh action does not trigger runUserSync.mutateAsync(...) via inline or shared hook wiring",
    });
  }
}

if (failures.length > 0) {
  console.error("Stale refresh sync wiring check failed:");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.reason}`);
  }
  process.exit(1);
}

console.log("Stale refresh sync wiring check passed");

function assertPattern(source, file, pattern, reason) {
  if (pattern.test(source)) {
    return;
  }
  failures.push({ file, reason });
}

async function findStaleStateTargets(directory) {
  const out = [];
  await walk(directory, out);
  out.sort();
  return out;
}

async function walk(directory, out) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolutePath, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) {
      continue;
    }
    const source = await readFile(absolutePath, "utf8");
    if (!source.includes("<StaleState")) {
      continue;
    }
    out.push(path.relative(root, absolutePath));
  }
}
