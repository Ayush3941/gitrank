import { Search, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

export function SearchInputWithClear({
  value,
  onChange,
  onClear,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  ariaControls,
  clearButtonLabel,
  clearButtonTitle = "Clear search",
  clearButtonDisabled = false,
  inputClassName = "pl-11 pr-11",
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  ariaLabel: string;
  ariaDescribedBy?: string;
  ariaControls?: string;
  clearButtonLabel: string;
  clearButtonTitle?: string;
  clearButtonDisabled?: boolean;
  inputClassName?: string;
}) {
  const hasValue = value.length > 0;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape" || !hasValue) {
      return;
    }
    event.preventDefault();
    onClear();
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className={inputClassName}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      />
      {hasValue ? (
        <button
          type="button"
          onClick={onClear}
          disabled={clearButtonDisabled}
          className="focus-ring absolute top-1/2 right-3 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-cyan-100 hover:bg-primary/12 hover:text-white disabled:opacity-60"
          aria-label={clearButtonLabel}
          aria-controls={ariaControls}
          title={clearButtonTitle}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
