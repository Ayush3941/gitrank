import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: check-frontend-ci-repo-sync-parity.mjs <repo-root>");
  process.exit(1);
}

const packageJSONPath = path.join(root, "frontend/package.json");
const workflowPath = path.join(root, ".github/workflows/frontend-ci.yml");
const repoSyncPath = path.join(root, "scripts/check-repo-sync.sh");

const packageJSON = JSON.parse(readFileSync(packageJSONPath, "utf8"));
const frontendScripts = packageJSON.scripts ?? {};
const workflowSource = readFileSync(workflowPath, "utf8");
const repoSyncSource = readFileSync(repoSyncPath, "utf8");

const workflowScriptNames = Array.from(
  workflowSource.matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g),
  (match) => match[1],
)
  .filter(Boolean)
  .sort();

const missingScripts = [];
const uncoveredScripts = [];

for (const scriptName of workflowScriptNames) {
  const scriptCommand = frontendScripts[scriptName];
  if (!scriptCommand) {
    missingScripts.push(scriptName);
    continue;
  }
  if (!isCoveredByRepoSync(scriptName, scriptCommand)) {
    uncoveredScripts.push(scriptName);
  }
}

if (missingScripts.length > 0 || uncoveredScripts.length > 0) {
  for (const scriptName of missingScripts) {
    console.error(`unknown frontend CI npm script: ${scriptName}`);
  }
  for (const scriptName of uncoveredScripts) {
    console.error(`frontend CI npm script not covered by repo sync: ${scriptName}`);
  }
  process.exit(1);
}

console.log("frontend CI/repo-sync parity check passed");

function isCoveredByRepoSync(scriptName, scriptCommand) {
  if (repoSyncSource.includes(`npm run ${scriptName}`)) {
    return true;
  }
  if (repoSyncSource.includes(`"${scriptName}|`) || repoSyncSource.includes(`"${scriptName}"`)) {
    return true;
  }

  for (const scriptPath of frontendScriptPaths(scriptCommand)) {
    if (repoSyncSource.includes(scriptPath)) {
      return true;
    }
  }

  return false;
}

function frontendScriptPaths(scriptCommand) {
  return Array.from(
    scriptCommand.matchAll(/\bscripts\/[A-Za-z0-9._/-]+\.mjs\b/g),
    (match) => match[0],
  );
}
