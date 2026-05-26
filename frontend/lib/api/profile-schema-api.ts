type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

type ApiProfileSection = {
  key: string;
  summary: string;
  status: string;
};

type ApiProfileSchemaResponse = {
  sections?: ApiProfileSection[];
};

export type ProfileSchemaSection = {
  key: string;
  summary: string;
  status: string;
};

export async function getProfileSchema(): Promise<ProfileSchemaSection[]> {
  const response = await fetch("/api/profile/schema", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Profile schema request failed."));
  }
  const payload = (await response.json()) as ApiProfileSchemaResponse;
  return (payload.sections ?? []).map((section) => ({
    key: section.key,
    summary: section.summary,
    status: section.status,
  }));
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
