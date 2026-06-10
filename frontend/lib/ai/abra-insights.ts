import "server-only";

import { createHash } from "node:crypto";
import type {
  AbraBadgeInput,
  AbraContributionInput,
  AbraInsightsRequest,
  AbraInsightsResponse,
  BadgeStory,
  ContributionNarrative,
  SkillInsight,
} from "@/lib/ai/abra-insights-types";
import {
  resolveAIProviderConfig,
  type AIProvider,
  type AIProviderConfig,
} from "@/lib/ai/ai-provider-config";
import { formatPercent, formatPluralCount, formatXpLabel } from "@/lib/formatters";

const CACHE_TTL_MS = 20 * 60 * 1000;
const MAX_CONTRIBUTIONS = 8;
const MAX_BADGES = 8;

const insightCache = new Map<string, { expiresAt: number; value: AbraInsightsResponse }>();

type OpenAIContentPart = {
  type?: string;
  text?: string;
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenAIContentPart[];
    };
  }>;
};

type AIInsightsShape = {
  archetype?: unknown;
  identity_summary?: unknown;
  contributions?: unknown;
  badges?: unknown;
  skill_assessment?: unknown;
};

type AIContributionItem = {
  id?: unknown;
  what?: unknown;
  why?: unknown;
  signal?: unknown;
  pitch?: unknown;
};

type AIBadgeItem = {
  id?: unknown;
  story?: unknown;
  trigger?: unknown;
  next_focus?: unknown;
};

type AISkillItem = {
  discipline?: unknown;
  summary?: unknown;
  evidence?: unknown;
  confidence?: unknown;
};

type OpenAIResponseFormatSchema = {
  name: string;
  strict: boolean;
  schema: ReturnType<typeof abraResponseSchema>;
};

type OpenAIChatCompletionRequest = {
  model: string;
  temperature: number;
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  response_format: {
    type: "json_schema";
    json_schema: OpenAIResponseFormatSchema;
  };
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
  const providerConfig = resolveAIProviderConfig();
  if (!providerConfig) {
    return cacheResult(cacheKey, fallback);
  }

  try {
    const generated = await generateOpenAIInsights(normalized, providerConfig);
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

  const skillInsights = fallbackSkillInsights(input);

  return {
    generatedBy: "deterministic",
    archetype,
    identitySummary,
    contributionNarratives,
    badgeStories,
    skillInsights,
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
  const mergedPrSummary = formatPluralCount(profile.mergedPrCount, "merged PR");
  const mergedPrVerb = profile.mergedPrCount === 1 ? "has" : "have";
  return `${profile.displayName} currently profiles as a ${archetype}, with strongest evidence in ${signal}. ${mergedPrSummary} ${mergedPrVerb} produced ${formatXpLabel(profile.totalXp)} so far, with a contribution streak of ${formatPluralCount(profile.streakDays, "day")} and ${formatPluralCount(profile.repositoriesTouched, "repository", "repositories")} touched.`;
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
    why: `This was rated as ${challenge} work by the score ledger and contributed ${formatXpLabel(input.xpEarned)}.`,
    signal:
      input.evidenceSignals[0] ||
      "Shows ability to ship and close contribution loops with evidence-backed outcomes.",
    pitch: `${input.owner}/${input.repo}#${input.number} demonstrates practical ${input.category.toLowerCase()} execution with measurable XP impact.`,
  };
}

function fallbackBadgeStory(input: AbraBadgeInput): BadgeStory {
  const progressNote = input.unlocked
    ? `Unlocked with verified evidence from ${formatPluralCount(Math.max(1, input.evidencePrIds.length), "PR reference")}.`
    : `${formatPercent(input.progress)} progress tracked against unlock criteria.`;
  return {
    story: `${input.name} (${input.rarity}) reflects a repeated contribution pattern: ${input.description}`,
    trigger: progressNote,
    nextFocus: input.unlockCondition,
  };
}

function fallbackSkillInsights(input: AbraInsightsRequest): Record<string, SkillInsight> {
  const disciplineSet = new Set<string>();
  for (const strongestSignal of input.profile.strongestSignals) {
    const normalized = normalizeDisciplineKey(strongestSignal);
    if (normalized) {
      disciplineSet.add(normalized);
    }
  }
  for (const contribution of input.contributions) {
    const normalized = normalizeDisciplineKey(contribution.category);
    if (normalized) {
      disciplineSet.add(normalized);
    }
  }

  const out: Record<string, SkillInsight> = {};
  for (const discipline of disciplineSet) {
    const related = input.contributions.filter(
      (row) => normalizeDisciplineKey(row.category) === discipline,
    );
    if (related.length === 0) {
      continue;
    }
    const totalXP = related.reduce((sum, row) => sum + Math.max(0, row.xpEarned), 0);
    const topEvidence =
      related
        .flatMap((row) => row.evidenceSignals)
        .find((signal) => signal.trim().length > 0) ||
      "Evidence-linked PR activity is present in this discipline.";

    out[discipline] = {
      discipline: titleCaseDiscipline(discipline),
      summary: `${formatPluralCount(related.length, "scored PR")} produced ${formatXpLabel(totalXP)} in this discipline.`,
      evidence: topEvidence,
      confidence: confidenceFromSampleSize(related.length),
    };
  }
  return out;
}

async function generateOpenAIInsights(
  input: AbraInsightsRequest,
  config: AIProviderConfig,
): Promise<AbraInsightsResponse> {
  const endpoint = `${config.baseURL.replace(/\/+$/, "")}/chat/completions`;

  const prompt = buildAIPrompt(input);
  const requestBody: OpenAIChatCompletionRequest = {
    model: config.model,
    temperature: 0.35,
    messages: [
      {
        role: "system",
        content:
          "You write gamified but factual contributor intelligence copy. Use only provided evidence.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "abra_insights",
        strict: true,
        schema: abraResponseSchema(),
      },
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as OpenAIChatCompletionResponse;
  const text = extractOpenAIResponseText(payload.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error("OpenAI response did not include generated text");
  }

  const parsed = JSON.parse(text) as AIInsightsShape;
  return normalizeAIResponse(parsed, config.provider);
}

function extractOpenAIResponseText(content: string | OpenAIContentPart[] | undefined): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function buildAIPrompt(input: AbraInsightsRequest): string {
  return [
    "You are writing gamified but accurate contributor intelligence copy for GitRank.",
    "Do not invent facts. Use only the provided structured data.",
    "Strict policy: deterministic PR XP is already finalized before this step.",
    "Never change, infer, or suggest new XP totals, rank changes, or score formula outcomes.",
    "You may only explain the provided evidence and already-awarded XP values.",
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
    "- skill_assessment[]: one item per discipline with discipline/summary/evidence/confidence.",
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
      skill_assessment: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            discipline: { type: "string" },
            summary: { type: "string" },
            evidence: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "emerging"] },
          },
          required: ["discipline", "summary", "evidence", "confidence"],
        },
      },
    },
    required: ["archetype", "identity_summary", "contributions", "badges", "skill_assessment"],
  };
}

function normalizeAIResponse(
  input: AIInsightsShape,
  provider: AIProvider,
): AbraInsightsResponse {
  const archetype = nonEmptyString(input.archetype) || "Systems Builder";
  const identitySummary =
    nonEmptyString(input.identity_summary) ||
    "Profile evidence is available, but AI identity synthesis fell back to deterministic phrasing.";

  const contributionNarratives: Record<string, ContributionNarrative> = {};
  if (Array.isArray(input.contributions)) {
    for (const item of input.contributions) {
      const row = item as AIContributionItem;
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
      const row = item as AIBadgeItem;
      const id = nonEmptyString(row.id);
      if (!id) continue;
      badgeStories[id] = {
        story: nonEmptyString(row.story) || "Badge reflects verified contribution evidence.",
        trigger: nonEmptyString(row.trigger) || "Unlocked through repeated validated activity.",
        nextFocus: nonEmptyString(row.next_focus) || "Continue building the same contribution profile.",
      };
    }
  }

  const skillInsights: Record<string, SkillInsight> = {};
  if (Array.isArray(input.skill_assessment)) {
    for (const item of input.skill_assessment) {
      const row = item as AISkillItem;
      const discipline = nonEmptyString(row.discipline);
      const key = normalizeDisciplineKey(discipline);
      if (!key) continue;
      const confidence = confidenceFromString(row.confidence);
      skillInsights[key] = {
        discipline: discipline || titleCaseDiscipline(key),
        summary:
          nonEmptyString(row.summary) ||
          "Scored PR evidence indicates repeated contribution quality in this area.",
        evidence:
          nonEmptyString(row.evidence) ||
          "Evidence signals were derived from scored PR metadata and explanations.",
        confidence,
      };
    }
  }

  return {
    generatedBy: provider,
    archetype,
    identitySummary,
    contributionNarratives,
    badgeStories,
    skillInsights,
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
  const skillInsights: Record<string, SkillInsight> = {
    ...fallback.skillInsights,
    ...generated.skillInsights,
  };

  return {
    generatedBy: generated.generatedBy,
    archetype: generated.archetype || fallback.archetype,
    identitySummary: generated.identitySummary || fallback.identitySummary,
    contributionNarratives,
    badgeStories,
    skillInsights,
  };
}

function normalizeDisciplineKey(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.includes("doc")) return "documentation";
  if (normalized.includes("test")) return "testing";
  if (normalized.includes("bug")) return "bug fix";
  if (normalized.includes("infra") || normalized.includes("devops")) return "infrastructure";
  if (normalized.includes("security")) return "security";
  if (normalized.includes("performance")) return "performance";
  if (normalized.includes("architecture")) return "architecture";
  if (normalized.includes("review")) return "review";
  if (normalized.includes("front")) return "frontend";
  if (normalized.includes("backend")) return "backend";
  return normalized;
}

function titleCaseDiscipline(value: string): string {
  return value
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function confidenceFromSampleSize(samples: number): "high" | "medium" | "emerging" {
  if (samples >= 4) return "high";
  if (samples >= 2) return "medium";
  return "emerging";
}

function confidenceFromString(value: unknown): "high" | "medium" | "emerging" {
  if (value === "high" || value === "medium" || value === "emerging") {
    return value;
  }
  return "emerging";
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}
