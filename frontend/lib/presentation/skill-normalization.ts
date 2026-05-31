import type { SkillNode } from "@/types/gitrank";

export function normalizeSkillToken(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return normalized;
  }

  if (normalized === "back end") {
    return "backend";
  }
  if (normalized === "front end") {
    return "frontend";
  }
  if (normalized === "dev ops") {
    return "devops";
  }
  if (normalized === "ci cd" || normalized === "ci/cd") {
    return "cicd";
  }
  if (normalized === "quality assurance" || normalized === "qa") {
    return "testing";
  }

  return normalized;
}

export function normalizeSkillCategory(value: string): string {
  const normalized = normalizeSkillToken(value);
  if (normalized === "devops") {
    return "infrastructure";
  }
  return normalized;
}

export function deduplicateSkillNodes(skills: SkillNode[]): SkillNode[] {
  const ordered: SkillNode[] = [];
  const indexByCategory = new Map<string, number>();

  for (const skill of skills) {
    const key = normalizeSkillCategory(skill.category);
    const existingIndex = indexByCategory.get(key);
    if (existingIndex === undefined) {
      indexByCategory.set(key, ordered.length);
      ordered.push(skill);
      continue;
    }
    const existing = ordered[existingIndex];
    if (skill.score > existing.score) {
      ordered[existingIndex] = {
        ...existing,
        ...skill,
      };
    }
  }

  return ordered;
}
