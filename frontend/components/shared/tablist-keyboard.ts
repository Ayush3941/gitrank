import type { KeyboardEvent } from "react";

export function handleHorizontalTabKeyDown(event: KeyboardEvent<HTMLElement>) {
  const option = event.currentTarget;
  const segmentedGroup = option.closest<HTMLElement>('[data-segmented-tablist="true"]');
  if (!segmentedGroup) {
    return;
  }

  const options = Array.from(
    segmentedGroup.querySelectorAll<HTMLElement>('[data-segmented-option="true"]'),
  ).filter((candidate) => !candidate.hasAttribute("disabled"));
  if (options.length === 0) {
    return;
  }
  const currentIndex = options.indexOf(option);
  if (currentIndex === -1) {
    return;
  }

  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % options.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + options.length) % options.length;
  } else if (event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % options.length;
  } else if (event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + options.length) % options.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = options.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  const nextOption = options[nextIndex];
  focusWithoutScroll(nextOption);
  nextOption.click();
}

function focusWithoutScroll(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}
