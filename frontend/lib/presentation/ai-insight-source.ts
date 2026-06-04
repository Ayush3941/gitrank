import type { AbraInsightSource } from "@/lib/ai/abra-insights-types";

export function formatAIInsightSourceLabel(source?: AbraInsightSource): string {
  if (source === "openai") {
    return "ChatGPT";
  }
  if (source === "gemini") {
    return "Gemini";
  }
  return "Deterministic";
}
