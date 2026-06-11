import { formatMonthDay } from "@/lib/formatters";

export function formatBadgeEarnedLabel(earnedAt?: string): string {
  return `Earned ${formatMonthDay(earnedAt, "date pending")}`;
}
