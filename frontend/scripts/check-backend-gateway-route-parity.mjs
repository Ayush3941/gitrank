import { promises as fs } from "node:fs";
import path from "node:path";

const FRONTEND_ROOT = path.resolve(process.cwd());
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");
const GATEWAY_MANIFEST_PATH = path.join(
  REPO_ROOT,
  "gitrank",
  "services",
  "api-gateway",
  "internal",
  "app",
  "manifest.go",
);

const EXCLUDED_BACKEND_ROUTES = new Set([
  "GET /healthz",
  "GET /readyz",
  "GET /metrics",
]);

const REQUIRED_GATEWAY_TO_BFF = new Map([
  ["GET /v1/meta/manifest", "app/api/meta/manifest/route.ts"],
  ["GET /v1/meta/dependencies", "app/api/meta/dependencies/route.ts"],
  ["GET /v1/profile/schema", "app/api/profile/schema/route.ts"],
  ["GET /v1/leaderboard", "app/api/leaderboard/route.ts"],
  ["GET /v1/pr/{owner}/{repo}/{number}/report", "app/api/pr/[owner]/[repo]/[number]/report/route.ts"],
  ["POST /v1/analytics/events", "app/api/analytics/events/route.ts"],
  ["POST /v1/sync", "app/api/sync/route.ts"],
  ["GET /v1/sync/runs", "app/api/sync/runs/route.ts"],
  ["POST /v1/sync/user/execute", "app/api/sync/user/route.ts"],
  ["POST /v1/sync/installation/execute", "app/api/sync/installation/route.ts"],
  ["POST /v1/sync/repository/execute", "app/api/sync/repository/route.ts"],
  ["POST /v1/sync/pull-request/execute", "app/api/sync/pull-request/route.ts"],
  ["POST /v1/sync/review/execute", "app/api/sync/review/route.ts"],
  ["POST /v1/sync/issue/execute", "app/api/sync/issue/route.ts"],
  ["POST /v1/sync/commit/execute", "app/api/sync/commit/route.ts"],
  ["POST /v1/me/account/unlink", "app/api/account/unlink/route.ts"],
  ["POST /v1/me/account/delete", "app/api/account/delete/route.ts"],
  ["GET /v1/me/profile", "app/api/profile/me/route.ts"],
  ["GET /v1/me/quests", "app/api/profile/me/quests/route.ts"],
  ["GET /v1/me/account/export", "app/api/account/export/route.ts"],
  ["PATCH /v1/me/profile", "app/api/profile/me/route.ts"],
  ["PATCH /v1/me/profile/repositories/{owner}/{repo}", "app/api/profile/me/repositories/[owner]/[repo]/route.ts"],
  ["GET /v1/users/{handle}", "app/api/profile/public/[username]/route.ts"],
  ["GET /v1/users/{handle}/card", "app/api/profile/public/[username]/card/route.ts"],
]);

async function main() {
  const manifestSource = await fs.readFile(GATEWAY_MANIFEST_PATH, "utf8");
  const backendRoutes = extractManifestRoutes(manifestSource)
    .filter((entry) => !EXCLUDED_BACKEND_ROUTES.has(entry))
    .sort();

  const requiredRoutes = [...REQUIRED_GATEWAY_TO_BFF.keys()].sort();

  const missingInMapping = backendRoutes.filter((entry) => !REQUIRED_GATEWAY_TO_BFF.has(entry));
  const staleInMapping = requiredRoutes.filter((entry) => !backendRoutes.includes(entry));

  if (missingInMapping.length > 0 || staleInMapping.length > 0) {
    const lines = ["Gateway/BFF route parity mismatch detected."];
    if (missingInMapping.length > 0) {
      lines.push("Missing backend routes in REQUIRED_GATEWAY_TO_BFF:");
      lines.push(...missingInMapping.map((entry) => `  - ${entry}`));
    }
    if (staleInMapping.length > 0) {
      lines.push("Stale mapped routes not present in backend manifest:");
      lines.push(...staleInMapping.map((entry) => `  - ${entry}`));
    }
    throw new Error(lines.join("\n"));
  }

  for (const [, relativePath] of REQUIRED_GATEWAY_TO_BFF.entries()) {
    const absolute = path.join(FRONTEND_ROOT, relativePath);
    await fs.access(absolute);
  }

  console.log(`Gateway/BFF route parity passed (${backendRoutes.length} backend routes mapped).`);
}

function extractManifestRoutes(source) {
  const matches = source.matchAll(/\{Method:\s*"([^"]+)",\s*Path:\s*"([^"]+)"/g);
  const routes = [];
  for (const match of matches) {
    routes.push(`${match[1]} ${match[2]}`);
  }
  return routes;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
