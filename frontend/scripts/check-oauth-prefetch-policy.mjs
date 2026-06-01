#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["components", "features"];
const scanExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const excludedSegments = new Set([
  "__tests__",
  "tests",
  "test",
  "docs",
  "scripts",
  "node_modules",
]);

const violations = [];

for (const relativeTarget of scanRoots) {
  const absoluteTarget = path.join(root, relativeTarget);
  await walk(absoluteTarget);
}

if (violations.length > 0) {
  console.error("OAuth prefetch policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.reason}`);
    if (violation.snippet) {
      console.error(`  ${violation.snippet}`);
    }
  }
  console.error(
    "Use IntentPrefetchLink with prefetchMode=\"never\" (or Link with prefetch={false}) for /oauth/github/start links.",
  );
  process.exit(1);
}

console.log("OAuth prefetch policy check passed");

async function walk(targetPath) {
  let entries = [];
  try {
    entries = await readdir(targetPath, { withFileTypes: true });
  } catch {
    await scanFile(targetPath);
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      if (excludedSegments.has(entry.name)) {
        continue;
      }
      await walk(absolutePath);
      continue;
    }
    await scanFile(absolutePath);
  }
}

async function scanFile(absolutePath) {
  if (!scanExtensions.has(path.extname(absolutePath))) {
    return;
  }

  let source = "";
  try {
    source = await readFile(absolutePath, "utf8");
  } catch {
    return;
  }

  if (!source.includes("/oauth/github/start")) {
    return;
  }

  const relativePath = path.relative(root, absolutePath);
  const oauthHrefVariables = collectOAuthHrefVariables(source);
  const tagPattern = /<(IntentPrefetchLink|Link)\b[\s\S]*?>/g;
  let match = tagPattern.exec(source);

  while (match) {
    const component = match[1] ?? "";
    const snippet = (match[0] ?? "").replace(/\s+/g, " ").trim();
    const startsAt = match.index ?? 0;
    const hrefVariable = extractHrefVariable(snippet);
    const referencesOAuthRoute =
      oauthHrefLiteral(snippet) ||
      (hrefVariable ? oauthHrefVariables.has(hrefVariable) : false);

    if (!referencesOAuthRoute) {
      match = tagPattern.exec(source);
      continue;
    }

    const hasRequiredPrefetchPolicy =
      component === "IntentPrefetchLink"
        ? /prefetchMode\s*=\s*(?:"never"|'never'|\{\s*"never"\s*\}|\{\s*'never'\s*\})/.test(
            snippet,
          )
        : /prefetch\s*=\s*\{false\}/.test(snippet);

    if (!hasRequiredPrefetchPolicy) {
      violations.push({
        file: relativePath,
        line: lineFromOffset(source, startsAt),
        reason: `${component} targeting /oauth/github/start is missing strict prefetch disable policy`,
        snippet,
      });
    }

    match = tagPattern.exec(source);
  }
}

function collectOAuthHrefVariables(source) {
  const variables = new Set();
  const variablePattern =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:`[^`]*\/oauth\/github\/start[^`]*`|"[^"]*\/oauth\/github\/start[^"]*"|'[^']*\/oauth\/github\/start[^']*')/g;

  let match = variablePattern.exec(source);
  while (match) {
    if (match[1]) {
      variables.add(match[1]);
    }
    match = variablePattern.exec(source);
  }

  return variables;
}

function oauthHrefLiteral(snippet) {
  return /href\s*=\s*(?:"[^"]*\/oauth\/github\/start[^"]*"|'[^']*\/oauth\/github\/start[^']*'|`[^`]*\/oauth\/github\/start[^`]*`)/.test(
    snippet,
  );
}

function extractHrefVariable(snippet) {
  const variableMatch = /href\s*=\s*\{([A-Za-z_$][\w$]*)\}/.exec(snippet);
  return variableMatch?.[1] ?? null;
}

function lineFromOffset(source, offset) {
  return source.slice(0, Math.max(0, offset)).split("\n").length;
}
