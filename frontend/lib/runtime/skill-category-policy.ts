import type { SkillCategory } from "@/types/gitrank";

const aliasToSkillCategory: Record<string, SkillCategory> = {
  architecture: "Architecture",
  arch: "Architecture",
  backend: "Backend",
  back_end: "Backend",
  service: "Backend",
  services: "Backend",
  api: "Backend",
  server: "Backend",
  bugfix: "Backend",
  bug_fix: "Backend",
  devops: "DevOps",
  dev_ops: "DevOps",
  infra: "DevOps",
  infrastructure: "DevOps",
  docs: "Documentation",
  doc: "Documentation",
  documentation: "Documentation",
  frontend: "Frontend",
  front_end: "Frontend",
  ui: "Frontend",
  ux: "Frontend",
  review: "Review",
  reviews: "Review",
  code_review: "Review",
  security: "Security",
  secure: "Security",
  hardening: "Security",
  testing: "Testing",
  test: "Testing",
  tests: "Testing",
  qa: "Testing",
  performance: "Performance",
  perf: "Performance",
  optimization: "Performance",
};

export function normalizeSkillCategory(
  value: string,
  fallback: SkillCategory = "Backend",
): SkillCategory {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const direct = aliasToSkillCategory[normalized];
  if (direct) {
    return direct;
  }
  if (normalized.includes("front") || normalized.includes("ui") || normalized.includes("ux")) {
    return "Frontend";
  }
  if (normalized.includes("doc")) {
    return "Documentation";
  }
  if (normalized.includes("test") || normalized.includes("qa")) {
    return "Testing";
  }
  if (normalized.includes("sec") || normalized.includes("auth")) {
    return "Security";
  }
  if (
    normalized.includes("infra") ||
    normalized.includes("ops") ||
    normalized.includes("deploy") ||
    normalized.includes("ci") ||
    normalized.includes("cd")
  ) {
    return "DevOps";
  }
  if (normalized.includes("perf") || normalized.includes("optimiz")) {
    return "Performance";
  }
  if (normalized.includes("review")) {
    return "Review";
  }
  if (
    normalized.includes("api") ||
    normalized.includes("service") ||
    normalized.includes("backend") ||
    normalized.includes("server") ||
    normalized.includes("bug")
  ) {
    return "Backend";
  }
  return fallback;
}
