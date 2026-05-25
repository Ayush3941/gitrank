type ScrollSnapshot = {
  node: HTMLElement;
  left: number;
  top: number;
};

export function focusWithoutScroll(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
    return;
  } catch {
    // Browser does not support focus options; fallback below.
  }

  const snapshots = captureScrollableAncestors(element);
  element.focus();
  restoreScrollSnapshots(snapshots);
}

function captureScrollableAncestors(element: HTMLElement): ScrollSnapshot[] {
  const snapshots: ScrollSnapshot[] = [];
  let cursor: HTMLElement | null = element.parentElement;

  while (cursor) {
    if (isScrollable(cursor)) {
      snapshots.push({
        node: cursor,
        left: cursor.scrollLeft,
        top: cursor.scrollTop,
      });
    }
    cursor = cursor.parentElement;
  }

  const scrollingElement = element.ownerDocument.scrollingElement;
  if (scrollingElement instanceof HTMLElement) {
    snapshots.push({
      node: scrollingElement,
      left: scrollingElement.scrollLeft,
      top: scrollingElement.scrollTop,
    });
  }

  return snapshots;
}

function restoreScrollSnapshots(snapshots: ScrollSnapshot[]) {
  for (const snapshot of snapshots) {
    if (snapshot.node.scrollLeft !== snapshot.left) {
      snapshot.node.scrollLeft = snapshot.left;
    }
    if (snapshot.node.scrollTop !== snapshot.top) {
      snapshot.node.scrollTop = snapshot.top;
    }
  }
}

function isScrollable(node: HTMLElement): boolean {
  return node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth;
}
