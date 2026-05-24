import { normalizeSkillToken } from "@/lib/presentation/skill-normalization";

export function uniqueDisplayValues(
  values: readonly string[],
  maxItems = Number.POSITIVE_INFINITY,
): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = normalizeValue(trimmed);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(trimmed);
    if (output.length >= maxItems) {
      break;
    }
  }

  return output;
}

function normalizeValue(value: string): string {
  return normalizeSkillToken(value);
}
