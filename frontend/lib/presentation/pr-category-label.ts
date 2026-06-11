import { normalizePRCategory } from "@/lib/runtime/pr-category-policy";
import type { PRCategory } from "@/types/gitrank";

export function formatPRCategoryLabel(category?: PRCategory | string): string {
  const normalized = normalizePRCategory(String(category ?? ""));
  return normalized === "Unknown" ? "Unclassified" : normalized;
}
