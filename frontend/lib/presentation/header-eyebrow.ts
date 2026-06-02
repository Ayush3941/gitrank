export function shouldShowHeaderEyebrow(
  eyebrow: string | undefined,
  title: string,
): eyebrow is string {
  return (
    typeof eyebrow === "string" &&
    normalizeHeaderToken(eyebrow) !== normalizeHeaderToken(title)
  );
}

function normalizeHeaderToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
