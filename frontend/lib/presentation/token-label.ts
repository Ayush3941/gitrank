export function formatTokenLabel(value: string): string {
  const cleaned = value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  return cleaned
    .split(" ")
    .map((part, index) => formatTokenPart(part, index === 0))
    .join(" ");
}

function formatTokenPart(part: string, isFirst: boolean): string {
  const normalized = part.toLowerCase();
  if (normalized === "ai") {
    return "AI";
  }
  if (normalized === "api") {
    return "API";
  }
  if (normalized === "ci") {
    return "CI";
  }
  if (normalized === "pr") {
    return "PR";
  }
  if (normalized === "xp") {
    return "XP";
  }
  if (isFirst) {
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }
  return normalized;
}
