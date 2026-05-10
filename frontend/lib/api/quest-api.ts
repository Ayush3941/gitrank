import type { Quest, QuestStatus, SkillCategory } from "@/types/gitrank";

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
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function getMyQuests(): Promise<Quest[]> {
  const response = await fetch("/api/profile/me/quests", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiUserQuestsResponse;
  return (payload.quests ?? []).map(toQuest);
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
      ? normalizeSkillCategory(quest.weak_area_target)
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

function normalizeSkillCategory(value: string): SkillCategory {
  const normalized = value.trim().toLowerCase();
  const mapped: Record<string, SkillCategory> = {
    architecture: "Architecture",
    backend: "Backend",
    devops: "DevOps",
    documentation: "Documentation",
    docs: "Documentation",
    frontend: "Frontend",
    infra: "DevOps",
    infrastructure: "DevOps",
    performance: "Performance",
    review: "Review",
    security: "Security",
    testing: "Testing",
    tests: "Testing",
  };
  return mapped[normalized] ?? "Backend";
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
