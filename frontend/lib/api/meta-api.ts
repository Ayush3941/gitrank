export type ServiceRouteSpec = {
  method: string;
  path: string;
  summary: string;
  status: string;
};

export type ServiceDependencySpec = {
  name: string;
  kind: string;
  base_url?: string;
  purpose: string;
  auth?: string;
  critical: boolean;
  status: string;
};

export type ServiceManifest = {
  service: string;
  description: string;
  version: string;
  routes: ServiceRouteSpec[];
  dependencies?: ServiceDependencySpec[];
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function getServiceManifest(): Promise<ServiceManifest> {
  const response = await fetch("/api/meta/manifest", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Service manifest request failed."));
  }
  return (await response.json()) as ServiceManifest;
}

export async function getServiceDependencies(): Promise<ServiceDependencySpec[]> {
  const response = await fetch("/api/meta/dependencies", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Service dependencies request failed."));
  }
  const payload = (await response.json()) as ServiceDependencySpec[];
  return Array.isArray(payload) ? payload : [];
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
