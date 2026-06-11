import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeDays, normalizeDateTime } from "@/lib/formatters";

type ExactTimeVisibility = "screen-reader" | "responsive" | "hidden";

export function RelativeTime({
  value,
  fallback = "Sync time unavailable",
  exactLabel = "Exact timestamp",
  exactVisibility = "screen-reader",
  className,
  exactClassName,
}: {
  value?: string;
  fallback?: string;
  exactLabel?: string;
  exactVisibility?: ExactTimeVisibility;
  className?: string;
  exactClassName?: string;
}) {
  const normalizedDateTime = normalizeDateTime(value);
  if (!normalizedDateTime) {
    return <span className={className}>{fallback}</span>;
  }

  const relative = formatRelativeDays(value);
  const exact = formatDateTime(value);
  const shouldExposeExact = exact !== "Unknown" && exactVisibility !== "hidden";

  return (
    <time className={className} dateTime={normalizedDateTime}>
      <span>{relative}</span>
      {shouldExposeExact ? <span className="sr-only">{`, ${exactLabel}: ${exact}`}</span> : null}
      {shouldExposeExact && exactVisibility === "responsive" ? (
        <span aria-hidden="true" className={cn("hidden sm:inline", exactClassName)}>
          {" "}
          ({exact})
        </span>
      ) : null}
    </time>
  );
}
