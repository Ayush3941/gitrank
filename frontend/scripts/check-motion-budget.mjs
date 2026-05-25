import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features", "hooks", "lib"];
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Motion budget check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Motion budget check passed");

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

  if (!/\.(css|[cm]?[jt]sx?)$/.test(entry)) return;
  if (entry.includes(`${path.sep}tests${path.sep}`)) return;

  const relative = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");

  if (/\bfrom\s+["']framer-motion["']/.test(source)) {
    violations.push(`${relative}: framer-motion import detected`);
  }

  if (/className\s*=\s*["'`][^"'`]*\banimate-[\w-]+/.test(source)) {
    violations.push(`${relative}: animation utility class detected`);
  }

  if (/@keyframes\b/.test(source)) {
    violations.push(`${relative}: keyframe animation declaration detected`);
  }

  for (const match of source.matchAll(/animation\s*:\s*([^;]+);/g)) {
    const rawValue = (match[1] ?? "").trim().toLowerCase();
    if (!rawValue) continue;
    if (rawValue.startsWith("none")) continue;
    violations.push(`${relative}: animation declaration detected (${rawValue})`);
  }

  if (/transition\s*:\s*all\b/.test(source)) {
    violations.push(`${relative}: transition: all is disallowed`);
  }
}
