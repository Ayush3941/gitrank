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

export type ServiceManifestProbe = {
  key: string;
  name: string;
  base_url: string;
  status: "ok" | "error";
  manifest?: ServiceManifest;
  error?: string;
};

export type ServiceManifestProbeResponse = {
  generated_at: string;
  services: ServiceManifestProbe[];
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function getServiceManifestProbes(): Promise<ServiceManifestProbeResponse> {
  const response = await fetch("/api/meta/services", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Service manifest probe failed."));
  }
  return (await response.json()) as ServiceManifestProbeResponse;
}

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  const defaultMessage = `${fallback} Status ${response.status}.`;
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error?.message?.trim() || defaultMessage;
  } catch {
    return defaultMessage;
  }
}
