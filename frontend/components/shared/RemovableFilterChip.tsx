import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function RemovableFilterChip({
  children,
  onRemove,
  ariaLabel,
  ariaControls,
  disabled = false,
  title = "Clear filter",
  className,
}: {
  children: ReactNode;
  onRemove: () => void;
  ariaLabel: string;
  ariaControls?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "focus-ring neon-chip neon-chip-muted inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
        className,
      )}
      onClick={onRemove}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-controls={ariaControls}
      title={title}
    >
      {children}
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
