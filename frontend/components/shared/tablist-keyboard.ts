import type { KeyboardEvent } from "react";

export function handleHorizontalTabKeyDown(event: KeyboardEvent<HTMLElement>) {
  const tab = event.currentTarget;
  const tablist = tab.closest<HTMLElement>('[role="tablist"]');
  if (!tablist) {
    return;
  }
  const tabs = Array.from(
    tablist.querySelectorAll<HTMLElement>('[role="tab"]'),
  ).filter((candidate) => !candidate.hasAttribute("disabled"));
  if (tabs.length === 0) {
    return;
  }
  const currentIndex = tabs.indexOf(tab);
  if (currentIndex === -1) {
    return;
  }

  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  const nextTab = tabs[nextIndex];
  focusWithoutScroll(nextTab);
  nextTab.click();
}

function focusWithoutScroll(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}
