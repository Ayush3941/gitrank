export type StableRenderRow<T> = {
  renderId: string;
  item: T;
};

export function buildStableRenderRows<T>(
  items: readonly T[],
  buildSeed: (item: T) => string,
  readPreferredId?: (item: T) => string | null | undefined,
): StableRenderRow<T>[] {
  const used = new Map<string, number>();

  return items.map((item) => {
    const preferredId = normalizeRenderId(readPreferredId?.(item));
    const seed = preferredId ?? normalizeRenderId(buildSeed(item)) ?? "row";
    const seenCount = used.get(seed) ?? 0;
    used.set(seed, seenCount + 1);

    return {
      renderId: seenCount === 0 ? seed : `${seed}#${seenCount + 1}`,
      item,
    };
  });
}

function normalizeRenderId(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, "-").toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}
