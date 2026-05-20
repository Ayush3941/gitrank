import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
const bannedClassTokens = [
  "text-slate-100",
  "text-slate-200",
  "text-slate-300",
  "text-slate-100/",
  "text-slate-200/",
  "text-slate-300/",
];
const allowlist = [
  {
    file: "features/settings/components/SettingsPageClient.tsx",
    mustInclude: "previewChipClassName",
  },
];

const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Readable text token guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Readable text token guard passed");

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
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    if (!bannedClassTokens.some((token) => line.includes(token))) {
      return;
    }
    if (isAllowlisted(relative, line)) {
      return;
    }
    violations.push(`${relative}:${index + 1} contains legacy low-contrast slate text class`);
  });
}

function isAllowlisted(relativePath, line) {
  return allowlist.some(
    (entry) =>
      entry.file === relativePath &&
      line.includes(entry.mustInclude),
  );
}
