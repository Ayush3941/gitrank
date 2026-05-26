import type { Quest, QuestStatus } from "@/types/gitrank";
import { normalizeSkillCategory as normalizeRuntimeSkillCategory } from "@/lib/runtime/skill-category-policy";

type ApiQuest = {
  id: string;
  title: string;
  description: string;
  status: string;
  cadence: string;
  reward_xp: number;
  reward_badge_key?: string;
  progress: number;
  goal: number;
  weak_area_target?: string;
  why_recommended: string;
  evidence_signals?: string[];
  linked_contribution_ids?: string[];
};

type ApiUserQuestsResponse = {
  quests?: ApiQuest[];
  generated_at?: string;
  staleness?: {
    refreshed_at?: string;
    stale_after?: string;
    source_watermark?: string;
    is_stale?: boolean;
    partial_profile_available?: boolean;
  };
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export type MyQuestsView = {
  quests: Quest[];
  generatedAt?: string;
  staleness?: {
    refreshedAt?: string;
    staleAfter?: string;
    sourceWatermark?: string;
    isStale: boolean;
    partialProfileAvailable: boolean;
  };
};

export async function getMyQuestsView(): Promise<MyQuestsView> {
  const response = await fetch("/api/profile/me/quests", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiUserQuestsResponse;
  return {
    quests: (payload.quests ?? []).map(toQuest),
    generatedAt: payload.generated_at,
    staleness: payload.staleness
      ? {
          refreshedAt: payload.staleness.refreshed_at,
          staleAfter: payload.staleness.stale_after,
          sourceWatermark: payload.staleness.source_watermark,
          isStale: payload.staleness.is_stale ?? false,
          partialProfileAvailable: payload.staleness.partial_profile_available ?? false,
        }
      : undefined,
  };
}

export async function getMyQuests(): Promise<Quest[]> {
  const view = await getMyQuestsView();
  return view.quests;
}

function toQuest(quest: ApiQuest): Quest {
  return {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    status: normalizeQuestStatus(quest.status),
    cadence: normalizeCadence(quest.cadence),
    rewardXp: quest.reward_xp,
    rewardBadgeId: quest.reward_badge_key,
    progress: Math.max(0, quest.progress),
    goal: Math.max(1, quest.goal),
    weakAreaTarget: quest.weak_area_target
      ? normalizeRuntimeSkillCategory(quest.weak_area_target)
      : undefined,
    whyRecommended: quest.why_recommended,
    evidenceSignals: quest.evidence_signals ?? [],
    linkedContributionIds: quest.linked_contribution_ids ?? [],
  };
}

function normalizeQuestStatus(value: string): QuestStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === "completed") return "Completed";
  if (normalized === "locked") return "Locked";
  return "Active";
}

function normalizeCadence(value: string): Quest["cadence"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "daily") return "Daily";
  if (normalized === "long-term" || normalized === "longterm") return "Long-term";
  if (normalized === "skill-based" || normalized === "skill") return "Skill-based";
  return "Weekly";
}

async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `Quest request failed with status ${response.status}.`;
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error?.message?.trim() || fallback;
  } catch {
    return fallback;
  }
}
