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
