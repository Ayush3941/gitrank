const DEFAULT_CARD_PAGE_SIZE = 12;
const DEFAULT_CARD_PAGE_SIZE_CONSTRAINED = 6;
const DEFAULT_ABRA_SAMPLE_LIMIT = 24;
const DEFAULT_RENDER_HARD_CAP = 100;
const DEFAULT_HIGH_XP_THRESHOLD = 200;

const MIN_CARD_PAGE_SIZE = 1;
const MAX_CARD_PAGE_SIZE = 100;
const MIN_RENDER_CAP = 1;
const MAX_RENDER_CAP = 300;
const MIN_HIGH_XP_THRESHOLD = 1;
const MAX_HIGH_XP_THRESHOLD = 5000;

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const integer = Math.trunc(value);
  if (integer < min || integer > max) {
    return fallback;
  }
  return integer;
}

const renderHardCap = parsePositiveInt(
  process.env.NEXT_PUBLIC_GITRANK_CONTRIBUTION_RENDER_HARD_CAP,
  DEFAULT_RENDER_HARD_CAP,
  MIN_RENDER_CAP,
  MAX_RENDER_CAP,
);

const abraSampleLimit = Math.min(
  renderHardCap,
  parsePositiveInt(
    process.env.NEXT_PUBLIC_GITRANK_ABRA_CONTRIBUTION_SAMPLE_LIMIT,
    DEFAULT_ABRA_SAMPLE_LIMIT,
    MIN_RENDER_CAP,
    MAX_RENDER_CAP,
  ),
);

export const contributionDisplayConfig = {
  cardPageSize: parsePositiveInt(
    process.env.NEXT_PUBLIC_GITRANK_CONTRIBUTION_CARD_PAGE_SIZE,
    DEFAULT_CARD_PAGE_SIZE,
    MIN_CARD_PAGE_SIZE,
    MAX_CARD_PAGE_SIZE,
  ),
  constrainedCardPageSize: parsePositiveInt(
    process.env.NEXT_PUBLIC_GITRANK_CONTRIBUTION_CARD_PAGE_SIZE_CONSTRAINED,
    DEFAULT_CARD_PAGE_SIZE_CONSTRAINED,
    MIN_CARD_PAGE_SIZE,
    MAX_CARD_PAGE_SIZE,
  ),
  renderHardCap,
  abraSampleLimit,
  highXPThreshold: parsePositiveInt(
    process.env.NEXT_PUBLIC_GITRANK_HIGH_XP_THRESHOLD,
    DEFAULT_HIGH_XP_THRESHOLD,
    MIN_HIGH_XP_THRESHOLD,
    MAX_HIGH_XP_THRESHOLD,
  ),
} as const;
