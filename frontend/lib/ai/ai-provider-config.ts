import type { AbraInsightSource } from "@/lib/ai/abra-insights-types";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export type AIProvider = Exclude<AbraInsightSource, "deterministic">;

export type AIProviderConfig = {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseURL: string;
};

export function resolveAIProviderConfig(
  env: Pick<NodeJS.ProcessEnv, string> = process.env,
): AIProviderConfig | null {
  const configuredProvider = normalizeAIProvider(env.AI_PROVIDER);
  if (configuredProvider) {
    return configForProvider(configuredProvider, env);
  }

  if (env.OPENAI_API_KEY?.trim()) {
    return configForProvider("openai", env);
  }
  if (env.GEMINI_API_KEY?.trim()) {
    return configForProvider("gemini", env);
  }
  return null;
}

function normalizeAIProvider(value: string | undefined): AIProvider | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "openai" || normalized === "gemini") {
    return normalized;
  }
  return null;
}

function configForProvider(
  provider: AIProvider,
  env: Pick<NodeJS.ProcessEnv, string>,
): AIProviderConfig | null {
  if (provider === "gemini") {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }
    return {
      provider,
      apiKey,
      model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      baseURL: env.GEMINI_BASE_URL?.trim() || DEFAULT_GEMINI_BASE_URL,
    };
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return {
    provider,
    apiKey,
    model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    baseURL: env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
  };
}
