import { cn } from "@/lib/cn";

type NoticeVariant = "info" | "success" | "warning" | "error";

const variantClassName: Record<NoticeVariant, string> = {
  info: "border-cyan-300/24 bg-cyan-400/8 text-cyan-100",
  success: "border-emerald-300/24 bg-emerald-400/10 text-emerald-100",
  warning: "border-amber-300/24 bg-amber-400/10 text-amber-100",
  error: "border-rose-300/26 bg-rose-500/10 text-rose-100",
};

export function InlineNotice({
  message,
  placeholder = "Status",
  variant = "info",
  className,
  minHeightClassName = "min-h-6",
  onDismiss,
  dismissLabel = "Dismiss status message",
}: {
  message?: string;
  placeholder?: string;
  variant?: NoticeVariant;
  className?: string;
  minHeightClassName?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  if (!message) {
    return (
      <div className={cn(minHeightClassName, className)}>
        <p aria-hidden="true" className="text-sm opacity-0 select-none">
          {placeholder}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(minHeightClassName, className)}>
      <div
        className={cn(
          "inline-flex items-start rounded-[var(--radius-universal)] border px-3 py-1.5 text-sm",
          variantClassName[variant],
        )}
      >
        <span role="status" aria-live="polite" aria-atomic="true" className="min-w-0 break-anywhere">
          {message}
        </span>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="focus-ring ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/35 text-base leading-none hover:bg-black/15"
            aria-label={dismissLabel}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
