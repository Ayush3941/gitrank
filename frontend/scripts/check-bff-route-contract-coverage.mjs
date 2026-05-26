import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const API_DIR = path.join(ROOT, "app", "api");
const CONTRACT_TEST = path.join(ROOT, "tests", "bff-route-contract.test.ts");

async function main() {
  const routes = await listRouteFiles(API_DIR);
  const contractTestSource = await fs.readFile(CONTRACT_TEST, "utf8");

  const proxyRoutes = [];
  for (const routeFile of routes) {
    const source = await fs.readFile(routeFile, "utf8");
    if (!source.includes("proxyGateway(") && !source.includes("proxyAuth(")) {
      continue;
    }
    const relative = path.relative(ROOT, routeFile).replace(/\\/g, "/");
    const modulePath = `@/${relative.replace(/\.ts$/, "")}`;
    proxyRoutes.push(modulePath);
  }

  const missing = proxyRoutes.filter((modulePath) => !contractTestSource.includes(modulePath));
  if (missing.length > 0) {
    const details = missing.map((entry) => `  - ${entry}`).join("\n");
    throw new Error(
      [
        "BFF route contract coverage is incomplete.",
        "Each proxy route module must be imported in tests/bff-route-contract.test.ts.",
        details,
      ].join("\n"),
    );
  }

  console.log(`BFF route contract coverage passed (${proxyRoutes.length} proxy routes covered).`);
}

async function listRouteFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listRouteFiles(absolute)));
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      files.push(absolute);
    }
  }
  return files;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
