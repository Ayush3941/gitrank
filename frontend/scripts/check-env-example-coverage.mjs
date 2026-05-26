import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const envExamplePath = path.join(root, ".env.example");
const scanTargets = ["app", "components", "features", "hooks", "lib", "next.config.ts", "proxy.ts"];
const ignoredKeys = new Set(["NODE_ENV"]);
const usedEnvKeys = new Set();

for (const target of scanTargets) {
  walk(path.join(root, target));
}

const declaredKeys = parseEnvExample(envExamplePath);
const missingKeys = [...usedEnvKeys].filter((key) => !declaredKeys.has(key) && !ignoredKeys.has(key)).sort();
const unusedKeys = [...declaredKeys].filter((key) => !usedEnvKeys.has(key) && !ignoredKeys.has(key)).sort();

if (missingKeys.length > 0 || unusedKeys.length > 0) {
  console.error("frontend .env.example coverage check failed.");
  if (missingKeys.length > 0) {
    console.error("Missing keys in frontend/.env.example:");
    for (const key of missingKeys) {
      console.error(`- ${key}`);
    }
  }
  if (unusedKeys.length > 0) {
    console.error("Unused keys in frontend/.env.example:");
    for (const key of unusedKeys) {
      console.error(`- ${key}`);
    }
  }
  process.exit(1);
}

console.log("frontend .env.example coverage check passed");

function walk(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) {
    return;
  }

  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      if (child === "node_modules" || child === ".next" || child === "dist") {
        continue;
      }
      walk(path.join(entry, child));
    }
    return;
  }

  if (!/\.[cm]?[jt]sx?$/.test(entry)) {
    return;
  }

  const source = readFileSync(entry, "utf8");
  collectDotNotationEnvKeys(source);
  collectBracketNotationEnvKeys(source);
  collectStringLiteralEnvKeys(source);
}

function collectDotNotationEnvKeys(source) {
  const matches = source.matchAll(/process\.env\.([A-Z0-9_]+)/g);
  for (const match of matches) {
    const key = match[1]?.trim();
    if (key) {
      usedEnvKeys.add(key);
    }
  }
}

function collectBracketNotationEnvKeys(source) {
  const matches = source.matchAll(/process\.env\[(["'])([A-Z0-9_]+)\1\]/g);
  for (const match of matches) {
    const key = match[2]?.trim();
    if (key) {
      usedEnvKeys.add(key);
    }
  }
}

function collectStringLiteralEnvKeys(source) {
  const matches = source.matchAll(/["']([A-Z][A-Z0-9_]*_[A-Z0-9_]+)["']/g);
  for (const match of matches) {
    const key = match[1]?.trim();
    if (key) {
      usedEnvKeys.add(key);
    }
  }
}

function parseEnvExample(filePath) {
  const contents = readFileSync(filePath, "utf8");
  const keys = new Set();
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    if (/^[A-Z0-9_]+$/.test(key)) {
      keys.add(key);
    }
  }
  return keys;
}
