import { buildAbraInsights } from "@/lib/ai/abra-insights";
import type { AbraInsightsRequest } from "@/lib/ai/abra-insights-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<AbraInsightsRequest>;
    const validated = validatePayload(payload);
    const insights = await buildAbraInsights(validated);

    return Response.json(insights, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate ABRA insights.",
        },
      },
      { status: 400 },
    );
  }
}

function validatePayload(input: Partial<AbraInsightsRequest>): AbraInsightsRequest {
  if (!input.profile) {
    throw new Error("profile is required");
  }
  if (!Array.isArray(input.contributions)) {
    throw new Error("contributions must be an array");
  }
  if (!Array.isArray(input.badges)) {
    throw new Error("badges must be an array");
  }

  return {
    profile: {
      username: safeString(input.profile.username, "profile.username"),
      displayName: safeString(input.profile.displayName, "profile.displayName"),
      currentTitle: safeString(input.profile.currentTitle, "profile.currentTitle"),
      rankTier: safeString(input.profile.rankTier, "profile.rankTier"),
      level: safeNumber(input.profile.level, "profile.level"),
      totalXp: safeNumber(input.profile.totalXp, "profile.totalXp"),
      mergedPrCount: safeNumber(input.profile.mergedPrCount, "profile.mergedPrCount"),
      strongestSignals: safeStringArray(input.profile.strongestSignals),
      repositoriesTouched: safeNumber(input.profile.repositoriesTouched, "profile.repositoriesTouched"),
      badgeCount: safeNumber(input.profile.badgeCount, "profile.badgeCount"),
      streakDays: safeNumber(input.profile.streakDays, "profile.streakDays"),
    },
    contributions: input.contributions.map((item, index) => ({
      id: safeString(item?.id, `contributions[${index}].id`),
      title: safeString(item?.title, `contributions[${index}].title`),
      owner: safeString(item?.owner, `contributions[${index}].owner`),
      repo: safeString(item?.repo, `contributions[${index}].repo`),
      number: safeNumber(item?.number, `contributions[${index}].number`),
      category: safeString(item?.category, `contributions[${index}].category`),
      status: safeString(item?.status, `contributions[${index}].status`),
      xpEarned: safeNumber(item?.xpEarned, `contributions[${index}].xpEarned`),
      mergedAt: safeString(item?.mergedAt, `contributions[${index}].mergedAt`),
      summary: typeof item?.summary === "string" ? item.summary : undefined,
      evidenceSignals: safeStringArray(item?.evidenceSignals),
    })),
    badges: input.badges.map((item, index) => ({
      id: safeString(item?.id, `badges[${index}].id`),
      name: safeString(item?.name, `badges[${index}].name`),
      rarity: safeString(item?.rarity, `badges[${index}].rarity`),
      unlocked: Boolean(item?.unlocked),
      earnedAt: typeof item?.earnedAt === "string" ? item.earnedAt : undefined,
      description: safeString(item?.description, `badges[${index}].description`),
      unlockCondition: safeString(item?.unlockCondition, `badges[${index}].unlockCondition`),
      progress: safeNumber(item?.progress, `badges[${index}].progress`),
      evidencePrIds: safeStringArray(item?.evidencePrIds),
    })),
  };
}

function safeString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function safeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${field} must be a number`);
  }
  return value;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
