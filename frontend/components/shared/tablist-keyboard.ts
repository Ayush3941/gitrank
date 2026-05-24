import type { KeyboardEvent } from "react";

export type TablistKeyboardActivation = "automatic" | "manual";

export function handleHorizontalTabKeyDown(
  event: KeyboardEvent<HTMLElement>,
  options?: {
    activationMode?: TablistKeyboardActivation;
    onActivate?: (option: HTMLElement) => void;
  },
) {
  const option = event.currentTarget;
  const segmentedGroup = option.closest<HTMLElement>('[data-segmented-tablist="true"]');
  if (!segmentedGroup) {
    return;
  }

  const tabOptions = Array.from(
    segmentedGroup.querySelectorAll<HTMLElement>('[data-segmented-option="true"]'),
  ).filter((candidate) => !candidate.hasAttribute("disabled"));
  if (tabOptions.length === 0) {
    return;
  }
  const currentIndex = tabOptions.indexOf(option);
  if (currentIndex === -1) {
    return;
  }

  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % tabOptions.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + tabOptions.length) % tabOptions.length;
  } else if (event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % tabOptions.length;
  } else if (event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + tabOptions.length) % tabOptions.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabOptions.length - 1;
  } else {
    if (
      (event.key === "Enter" || event.key === " ") &&
      (options?.activationMode ?? "manual") === "manual"
    ) {
      event.preventDefault();
      activateOption(option, options?.onActivate);
    }
    return;
  }

  event.preventDefault();
  const nextOption = tabOptions[nextIndex];
  focusWithoutScroll(nextOption);
  if ((options?.activationMode ?? "manual") === "automatic") {
    activateOption(nextOption, options?.onActivate);
  }
}

function focusWithoutScroll(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function activateOption(
  option: HTMLElement,
  onActivate?: (option: HTMLElement) => void,
) {
  if (typeof onActivate === "function") {
    onActivate(option);
    return;
  }
  option.click();
}
