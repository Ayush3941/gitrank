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
  fallback: PRCategory = "Backend",
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

export function inferPRCategoryFromText(
  title: string,
  explanation: string[] = [],
  fallback: PRCategory = "Backend",
): PRCategory {
  const text = `${title} ${explanation.join(" ")}`.toLowerCase();
  if (text.includes("security")) return "Security";
  if (text.includes("performance")) return "Performance";
  if (text.includes("test")) return "Testing";
  if (text.includes("doc")) return "Documentation";
  if (text.includes("infra") || text.includes("deploy") || text.includes("kubernetes")) return "Infrastructure";
  if (text.includes("review")) return "Review";
  if (text.includes("architecture")) return "Architecture";
  if (text.includes("bug") || text.includes("fix")) return "Bug Fix";
  return fallback;
}
