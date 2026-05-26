import type { PRCategory } from "@/types/gitrank";

const aliasToCategory: Record<string, PRCategory> = {
  architecture: "Architecture",
  arch: "Architecture",
  maintainer_design: "Architecture",
  design: "Architecture",
  backend: "Backend",
  feature: "Backend",
  refactor: "Backend",
  frontend: "Backend",
  "bug fix": "Bug Fix",
  bug_fix: "Bug Fix",
  bugfix: "Bug Fix",
  bug: "Bug Fix",
  fix: "Bug Fix",
  documentation: "Documentation",
  docs: "Documentation",
  doc: "Documentation",
  infrastructure: "Infrastructure",
  infra: "Infrastructure",
  devops: "Infrastructure",
  performance: "Performance",
  perf: "Performance",
  review: "Review",
  reviews: "Review",
  security: "Security",
  testing: "Testing",
  test: "Testing",
  tests: "Testing",
};

export function normalizePRCategory(
  value: string,
  fallback: PRCategory = "Unknown",
): PRCategory {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (!normalized) {
    return fallback;
  }
  return aliasToCategory[normalized] ?? fallback;
}
