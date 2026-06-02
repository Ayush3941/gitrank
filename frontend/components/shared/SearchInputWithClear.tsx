import { Search, X } from "lucide-react";
import { type KeyboardEvent, useRef } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value.length > 0;

  function restoreInputFocus() {
    queueMicrotask(() => {
      inputRef.current?.focus();
    });
  }

  function handleClear() {
    onClear();
    restoreInputFocus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape" || !hasValue) {
      return;
    }
    event.preventDefault();
    handleClear();
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <Input
        ref={inputRef}
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
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={handleClear}
          disabled={clearButtonDisabled}
          className="focus-ring absolute top-1/2 right-0.5 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-cyan-100 hover:bg-primary/12 hover:text-white disabled:opacity-60"
          aria-label={clearButtonLabel}
          aria-controls={ariaControls}
          title={clearButtonTitle}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
