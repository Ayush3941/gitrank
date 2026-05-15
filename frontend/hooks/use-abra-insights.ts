"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  AbraInsightsRequest,
  AbraInsightsResponse,
} from "@/lib/ai/abra-insights-types";

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export function useAbraInsights(payload: AbraInsightsRequest | null) {
  const fingerprint = payload ? fingerprintPayload(payload) : "none";

  return useQuery({
    queryKey: ["abra-insights", fingerprint],
    enabled: Boolean(payload),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!payload) {
        throw new Error("ABRA insights payload is missing.");
      }
      const response = await fetch("/api/ai/abra-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await responseErrorMessage(response));
      }
      return (await response.json()) as AbraInsightsResponse;
    },
  });
}

function fingerprintPayload(payload: AbraInsightsRequest): string {
  const contributionKey = payload.contributions
    .map((item) => `${item.id}:${item.xpEarned}`)
    .join("|");
  const badgeKey = payload.badges
    .map((item) => `${item.id}:${item.progress}:${item.unlocked ? "1" : "0"}`)
    .join("|");

  return [
    payload.profile.username,
    payload.profile.level,
    payload.profile.totalXp,
    payload.profile.mergedPrCount,
    payload.profile.streakDays,
    contributionKey,
    badgeKey,
  ].join("::");
}

async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `ABRA insights request failed with status ${response.status}.`;
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error?.message?.trim() || fallback;
  } catch {
    return fallback;
  }
}
