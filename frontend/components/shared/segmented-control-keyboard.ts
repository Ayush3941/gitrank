import type { KeyboardEvent } from "react";
import { focusWithoutScroll } from "@/components/shared/focus-without-scroll";

export function handleSegmentedControlKeyDown(
  event: KeyboardEvent<HTMLElement>,
  options?: {
    onActivate?: (option: HTMLElement) => void;
  },
) {
  const option = event.currentTarget;
  const segmentedGroup = option.closest<HTMLElement>('[data-segmented-control="true"]');
  if (!segmentedGroup) {
    return;
  }

  const controlOptions = Array.from(
    segmentedGroup.querySelectorAll<HTMLElement>('[data-segmented-option="true"]'),
  ).filter((candidate) => !candidate.hasAttribute("disabled"));
  if (controlOptions.length === 0) {
    return;
  }
  const currentIndex = controlOptions.indexOf(option);
  if (currentIndex === -1) {
    return;
  }

  let nextIndex = currentIndex;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % controlOptions.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + controlOptions.length) % controlOptions.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = controlOptions.length - 1;
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activateOption(option, options?.onActivate);
    return;
  } else {
    return;
  }

  event.preventDefault();
  const nextOption = controlOptions[nextIndex];
  focusWithoutScroll(nextOption);
  activateOption(nextOption, options?.onActivate);
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
