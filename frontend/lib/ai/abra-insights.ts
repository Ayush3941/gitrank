import "server-only";

import { createHash } from "node:crypto";
import type {
  AbraBadgeInput,
  AbraContributionInput,
  AbraInsightsRequest,
  AbraInsightsResponse,
  BadgeStory,
  ContributionNarrative,
} from "@/lib/ai/abra-insights-types";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const CACHE_TTL_MS = 20 * 60 * 1000;
const MAX_CONTRIBUTIONS = 8;
const MAX_BADGES = 8;

const insightCache = new Map<string, { expiresAt: number; value: AbraInsightsResponse }>();

type GeminiCandidatePart = {
  text?: string;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiCandidatePart[];
  };
};

type GeminiResponsePayload = {
  candidates?: GeminiCandidate[];
};

type GeminiInsightsShape = {
  archetype?: unknown;
  identity_summary?: unknown;
  contributions?: unknown;
  badges?: unknown;
};

type GeminiContributionItem = {
  id?: unknown;
  what?: unknown;
  why?: unknown;
  signal?: unknown;
  pitch?: unknown;
};

type GeminiBadgeItem = {
  id?: unknown;
  story?: unknown;
  trigger?: unknown;
  next_focus?: unknown;
};

export async function buildAbraInsights(
  request: AbraInsightsRequest,
): Promise<AbraInsightsResponse> {
  const normalized = normalizeRequest(request);
  const cacheKey = hashPayload(normalized);
  const cached = insightCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const fallback = deterministicInsights(normalized);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return cacheResult(cacheKey, fallback);
  }

  try {
    const generated = await generateGeminiInsights(normalized, apiKey);
    const merged = mergeInsights(fallback, generated);
    return cacheResult(cacheKey, merged);
  } catch {
    return cacheResult(cacheKey, fallback);
  }
}

function cacheResult(key: string, value: AbraInsightsResponse): AbraInsightsResponse {
  insightCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

function normalizeRequest(input: AbraInsightsRequest): AbraInsightsRequest {
  return {
    profile: {
      ...input.profile,
      strongestSignals: input.profile.strongestSignals.slice(0, 6),
    },
    contributions: input.contributions.slice(0, MAX_CONTRIBUTIONS).map((item) => ({
      ...item,
      evidenceSignals: item.evidenceSignals.slice(0, 6),
      summary: item.summary?.slice(0, 280),
    })),
    badges: input.badges.slice(0, MAX_BADGES).map((badge) => ({
      ...badge,
      evidencePrIds: badge.evidencePrIds.slice(0, 4),
    })),
  };
}

function hashPayload(input: AbraInsightsRequest): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function deterministicInsights(input: AbraInsightsRequest): AbraInsightsResponse {
  const archetype = inferArchetype(
    input.profile.strongestSignals,
    input.contributions,
    input.badges,
  );
  const identitySummary = buildIdentitySummary(input, archetype);

  const contributionNarratives: Record<string, ContributionNarrative> = {};
  for (const contribution of input.contributions) {
    contributionNarratives[contribution.id] = fallbackContributionNarrative(contribution);
  }

  const badgeStories: Record<string, BadgeStory> = {};
  for (const badge of input.badges) {
    badgeStories[badge.id] = fallbackBadgeStory(badge);
  }

  return {
    generatedBy: "deterministic",
    archetype,
    identitySummary,
    contributionNarratives,
    badgeStories,
  };
}

function inferArchetype(
  strongestSignals: string[],
  contributions: AbraContributionInput[],
  badges: AbraBadgeInput[],
): string {
  const text = [
    ...strongestSignals,
    ...contributions.map((item) => item.category),
    ...badges.map((badge) => badge.name),
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("security")) return "Threat Guardian";
  if (text.includes("performance")) return "Latency Tuner";
  if (text.includes("test")) return "Quality Sentinel";
  if (text.includes("docs") || text.includes("documentation")) return "Knowledge Cartographer";
  if (text.includes("infra") || text.includes("devops") || text.includes("kubernetes")) return "Reliability Ranger";
  if (text.includes("architecture")) return "Systems Architect";
  if (text.includes("review")) return "Review Marshal";
  if (text.includes("frontend")) return "Interface Crafter";
  return "Systems Builder";
}

function buildIdentitySummary(input: AbraInsightsRequest, archetype: string): string {
  const profile = input.profile;
  const signal = profile.strongestSignals[0] ?? "backend";
  return `${profile.displayName} currently profiles as a ${archetype}, with strongest evidence in ${signal}. ${profile.mergedPrCount} merged PRs have produced ${profile.totalXp} XP so far, with a ${profile.streakDays}-day contribution streak and ${profile.repositoriesTouched} repositories touched.`;
}

function fallbackContributionNarrative(input: AbraContributionInput): ContributionNarrative {
  const area = input.category.toLowerCase();
  const challenge =
    input.xpEarned >= 500
      ? "high-impact"
      : input.xpEarned >= 250
        ? "medium-impact"
        : "steady";
  return {
    what: `Delivered a ${area} contribution in ${input.owner}/${input.repo} (${input.title}).`,
    why: `This was rated as ${challenge} work by the score ledger and contributed ${input.xpEarned} XP.`,
    signal:
      input.evidenceSignals[0] ||
      "Shows ability to ship and close contribution loops with evidence-backed outcomes.",
    pitch: `${input.owner}/${input.repo}#${input.number} demonstrates practical ${input.category.toLowerCase()} execution with measurable XP impact.`,
  };
}

function fallbackBadgeStory(input: AbraBadgeInput): BadgeStory {
  const progressNote = input.unlocked
    ? `Unlocked with verified evidence from ${Math.max(1, input.evidencePrIds.length)} PR references.`
    : `${input.progress}% progress tracked against unlock criteria.`;
  return {
    story: `${input.name} (${input.rarity}) reflects a repeated contribution pattern: ${input.description}`,
    trigger: progressNote,
    nextFocus: input.unlockCondition,
  };
}

async function generateGeminiInsights(
  input: AbraInsightsRequest,
  apiKey: string,
): Promise<AbraInsightsResponse> {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const endpoint = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;

  const prompt = buildGeminiPrompt(input);
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      responseMimeType: "application/json",
      responseJsonSchema: abraResponseSchema(),
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GeminiResponsePayload;
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new Error("Gemini response did not include generated text");
  }

  const parsed = JSON.parse(text) as GeminiInsightsShape;
  return normalizeGeminiResponse(parsed);
}

function buildGeminiPrompt(input: AbraInsightsRequest): string {
  return [
    "You are writing gamified but accurate contributor intelligence copy for GitRank.",
    "Do not invent facts. Use only the provided structured data.",
    "Tone: concise, energetic, evidence-aware, professional.",
    "Output must match the JSON schema exactly.",
    "",
    "Context JSON:",
    JSON.stringify(input),
    "",
    "Requirements:",
    "- archetype: short role-style title.",
    "- identity_summary: 2-3 sentences about strengths, momentum, and evidence posture.",
    "- contributions[]: one item per contribution id with what/why/signal/pitch.",
    "- badges[]: one item per badge id with story/trigger/next_focus.",
    "- Keep every field <= 240 characters.",
  ].join("\n");
}

function abraResponseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      archetype: { type: "string" },
      identity_summary: { type: "string" },
      contributions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            what: { type: "string" },
            why: { type: "string" },
            signal: { type: "string" },
            pitch: { type: "string" },
          },
          required: ["id", "what", "why", "signal", "pitch"],
        },
      },
      badges: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            story: { type: "string" },
            trigger: { type: "string" },
            next_focus: { type: "string" },
          },
          required: ["id", "story", "trigger", "next_focus"],
        },
      },
    },
    required: ["archetype", "identity_summary", "contributions", "badges"],
  };
}

function normalizeGeminiResponse(input: GeminiInsightsShape): AbraInsightsResponse {
  const archetype = nonEmptyString(input.archetype) || "Systems Builder";
  const identitySummary =
    nonEmptyString(input.identity_summary) ||
    "Profile evidence is available, but AI identity synthesis fell back to deterministic phrasing.";

  const contributionNarratives: Record<string, ContributionNarrative> = {};
  if (Array.isArray(input.contributions)) {
    for (const item of input.contributions) {
      const row = item as GeminiContributionItem;
      const id = nonEmptyString(row.id);
      if (!id) continue;
      contributionNarratives[id] = {
        what: nonEmptyString(row.what) || "Contribution completed with verified evidence.",
        why: nonEmptyString(row.why) || "This contribution moved score evidence for the profile.",
        signal: nonEmptyString(row.signal) || "Demonstrates reliable contribution execution.",
        pitch: nonEmptyString(row.pitch) || "Evidence-backed contribution with measurable impact.",
      };
    }
  }

  const badgeStories: Record<string, BadgeStory> = {};
  if (Array.isArray(input.badges)) {
    for (const item of input.badges) {
      const row = item as GeminiBadgeItem;
      const id = nonEmptyString(row.id);
      if (!id) continue;
      badgeStories[id] = {
        story: nonEmptyString(row.story) || "Badge reflects verified contribution evidence.",
        trigger: nonEmptyString(row.trigger) || "Unlocked through repeated validated activity.",
        nextFocus: nonEmptyString(row.next_focus) || "Continue building the same contribution lane.",
      };
    }
  }

  return {
    generatedBy: "gemini",
    archetype,
    identitySummary,
    contributionNarratives,
    badgeStories,
  };
}

function mergeInsights(
  fallback: AbraInsightsResponse,
  generated: AbraInsightsResponse,
): AbraInsightsResponse {
  const contributionNarratives: Record<string, ContributionNarrative> = {
    ...fallback.contributionNarratives,
    ...generated.contributionNarratives,
  };
  const badgeStories: Record<string, BadgeStory> = {
    ...fallback.badgeStories,
    ...generated.badgeStories,
  };

  return {
    generatedBy: generated.generatedBy,
    archetype: generated.archetype || fallback.archetype,
    identitySummary: generated.identitySummary || fallback.identitySummary,
    contributionNarratives,
    badgeStories,
  };
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}
