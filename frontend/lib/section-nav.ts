export function initialSectionFromHash<SectionID extends string>(
  sectionIds: readonly SectionID[],
  fallback: SectionID,
  rawHash?: string,
): SectionID {
  const sourceHash = rawHash ?? "";
  let normalized = sourceHash.replace(/^#/, "").trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    return fallback;
  }
  if (!normalized) {
    return fallback;
  }
  return sectionIds.includes(normalized as SectionID)
    ? (normalized as SectionID)
    : fallback;
}
