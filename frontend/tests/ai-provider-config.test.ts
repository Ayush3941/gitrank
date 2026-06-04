import { describe, expect, it } from "vitest";
import { resolveAIProviderConfig } from "@/lib/ai/ai-provider-config";
import { formatAIInsightSourceLabel } from "@/lib/presentation/ai-insight-source";

describe("resolveAIProviderConfig", () => {
  it("uses OpenAI config by default when an OpenAI key is present", () => {
    const config = resolveAIProviderConfig({
      OPENAI_API_KEY: "openai-key",
      OPENAI_MODEL: "openai-test-model",
      OPENAI_BASE_URL: "https://openai.test/v1",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-test-model",
      GEMINI_BASE_URL: "https://gemini.test/v1beta/openai",
    });

    expect(config).toEqual({
      provider: "openai",
      apiKey: "openai-key",
      model: "openai-test-model",
      baseURL: "https://openai.test/v1",
    });
  });

  it("uses Gemini config when AI_PROVIDER selects Gemini", () => {
    const config = resolveAIProviderConfig({
      AI_PROVIDER: "gemini",
      OPENAI_API_KEY: "openai-key",
      OPENAI_MODEL: "openai-test-model",
      OPENAI_BASE_URL: "https://openai.test/v1",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-test-model",
      GEMINI_BASE_URL: "https://gemini.test/v1beta/openai",
    });

    expect(config).toEqual({
      provider: "gemini",
      apiKey: "gemini-key",
      model: "gemini-test-model",
      baseURL: "https://gemini.test/v1beta/openai",
    });
  });

  it("falls back to Gemini only when no provider is selected and only Gemini has a key", () => {
    const config = resolveAIProviderConfig({
      GEMINI_API_KEY: "gemini-key",
    });

    expect(config).toEqual({
      provider: "gemini",
      apiKey: "gemini-key",
      model: "gemini-2.5-flash",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    });
  });

  it("returns null when the selected provider has no key", () => {
    expect(resolveAIProviderConfig({
      AI_PROVIDER: "openai",
      GEMINI_API_KEY: "gemini-key",
    })).toBeNull();
  });
});

describe("formatAIInsightSourceLabel", () => {
  it("distinguishes generated and deterministic identity summary sources", () => {
    expect(formatAIInsightSourceLabel("openai")).toBe("ChatGPT");
    expect(formatAIInsightSourceLabel("gemini")).toBe("Gemini");
    expect(formatAIInsightSourceLabel("deterministic")).toBe("Deterministic");
    expect(formatAIInsightSourceLabel()).toBe("Deterministic");
  });
});
