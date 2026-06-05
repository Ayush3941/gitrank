import { formatDateTime, normalizeDateTime } from "@/lib/formatters";

export function ExactTime({
  value,
  fallback = "time pending",
}: {
  value?: string | null;
  fallback?: string;
}) {
  const timestamp = normalizeDateTime(value ?? undefined);
  const label = formatDateTime(value ?? undefined, fallback);

  if (!timestamp) {
    return <>{label}</>;
  }

  return <time dateTime={timestamp}>{label}</time>;
}
