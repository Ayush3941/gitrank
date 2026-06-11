import type { Contribution } from "@/types/gitrank";

export type ContributionStatusTone = "muted" | "info" | "success" | "warning";

export function formatContributionStatusLabel(
  status: Contribution["status"] | string | undefined,
): string {
  const value = String(status ?? "").trim().toLowerCase();
  if (!value) {
    return "Status unavailable";
  }
  if (value === "merged") {
    return "Merged";
  }
  if (value === "open") {
    return "Open";
  }
  if (value === "closed") {
    return "Closed";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function toneForContributionStatus(
  status: Contribution["status"] | string | undefined,
): ContributionStatusTone {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "merged") {
    return "success";
  }
  if (value === "open") {
    return "info";
  }
  if (value === "closed") {
    return "warning";
  }
  return "muted";
}
