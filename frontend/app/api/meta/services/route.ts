export const dynamic = "force-dynamic";

type ServiceManifestRoute = {
  method: string;
  path: string;
  summary: string;
  status: string;
};

type ServiceManifestDependency = {
  name: string;
  kind: string;
  base_url?: string;
  purpose: string;
  auth?: string;
  critical: boolean;
  status: string;
};

type ServiceManifest = {
  service: string;
  description: string;
  version: string;
  routes?: ServiceManifestRoute[];
  dependencies?: ServiceManifestDependency[];
};

type ServiceProbe = {
  key: string;
  name: string;
  base_url: string;
  status: "ok" | "error";
  manifest?: ServiceManifest;
  error?: string;
};

const SERVICE_TARGETS: Array<{
  key: string;
  name: string;
  env: string[];
  fallback: string;
}> = [
  { key: "api_gateway", name: "api-gateway", env: ["GITRANK_API_BASE_URL"], fallback: "http://localhost:8080" },
  { key: "auth_service", name: "auth-service", env: ["GITRANK_AUTH_BASE_URL", "AUTH_SERVICE_BASE_URL"], fallback: "http://localhost:8081" },
  { key: "github_ingestor", name: "github-ingestor", env: ["GITHUB_INGESTOR_BASE_URL"], fallback: "http://localhost:8082" },
  { key: "pr_analyzer", name: "pr-analyzer", env: ["PR_ANALYZER_BASE_URL"], fallback: "http://localhost:8083" },
  { key: "profile_service", name: "profile-service", env: ["PROFILE_SERVICE_BASE_URL"], fallback: "http://localhost:8084" },
  { key: "scoring_engine", name: "scoring-engine", env: ["SCORING_ENGINE_BASE_URL"], fallback: "http://localhost:8085" },
  { key: "scheduler_worker", name: "scheduler-worker", env: ["SCHEDULER_WORKER_BASE_URL"], fallback: "http://localhost:8086" },
];

export async function GET() {
  const probes = await Promise.all(
    SERVICE_TARGETS.map(async (target): Promise<ServiceProbe> => {
      const baseURL = resolveBaseURL(target.env, target.fallback);
      const manifestURL = `${baseURL.replace(/\/$/, "")}/v1/meta/manifest`;
      try {
        const response = await fetchWithTimeout(manifestURL, 8_000);
        if (!response.ok) {
          return {
            key: target.key,
            name: target.name,
            base_url: baseURL,
            status: "error",
            error: `Status ${response.status}`,
          };
        }
        const manifest = (await response.json()) as ServiceManifest;
        return {
          key: target.key,
          name: target.name,
          base_url: baseURL,
          status: "ok",
          manifest,
        };
      } catch (error) {
        return {
          key: target.key,
          name: target.name,
          base_url: baseURL,
          status: "error",
          error: error instanceof Error ? error.message : "manifest fetch failed",
        };
      }
    }),
  );

  return Response.json({
    generated_at: new Date().toISOString(),
    services: probes,
  });
}

function resolveBaseURL(keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (!value) {
      continue;
    }
    try {
      return new URL(value).origin;
    } catch {
      continue;
    }
  }
  return fallback;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
