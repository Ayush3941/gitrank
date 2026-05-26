import { promises as fs } from "node:fs";
import path from "node:path";

const FRONTEND_ROOT = path.resolve(process.cwd());
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");
const AUTH_MANIFEST_PATH = path.join(
  REPO_ROOT,
  "gitrank",
  "services",
  "auth-service",
  "internal",
  "app",
  "manifest.go",
);

const REQUIRED_AUTH_TO_FRONTEND = new Map([
  ["GET /oauth/github/install", "app/oauth/github/install/route.ts"],
  ["GET /oauth/github/start", "app/oauth/github/start/route.ts"],
  ["GET /oauth/github/callback", "app/oauth/github/callback/route.ts"],
  ["POST /v1/account/link/start", "app/api/account/link/start/route.ts"],
  ["GET /v1/session/me", "app/api/session/me/route.ts"],
  ["POST /v1/session/refresh", "app/api/session/refresh/route.ts"],
  ["POST /v1/session/logout", "app/api/session/logout/route.ts"],
]);

async function main() {
  const manifestSource = await fs.readFile(AUTH_MANIFEST_PATH, "utf8");
  const authRoutes = extractManifestRoutes(manifestSource);
  const missingFromManifest = [...REQUIRED_AUTH_TO_FRONTEND.keys()].filter(
    (route) => !authRoutes.includes(route),
  );

  if (missingFromManifest.length > 0) {
    throw new Error(
      [
        "Required auth-service routes are missing from auth manifest.",
        ...missingFromManifest.map((route) => `  - ${route}`),
      ].join("\n"),
    );
  }

  for (const [, relativePath] of REQUIRED_AUTH_TO_FRONTEND.entries()) {
    await fs.access(path.join(FRONTEND_ROOT, relativePath));
  }

  console.log(`Auth-service/frontend parity passed (${REQUIRED_AUTH_TO_FRONTEND.size} routes).`);
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
