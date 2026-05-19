"use client";

import { useCallback, useEffect, useState } from "react";

type UseLazyInViewOptions = {
  rootMargin?: string;
  threshold?: number | number[];
  triggerOnce?: boolean;
};

export function useLazyInView(options?: UseLazyInViewOptions) {
  const {
    rootMargin = "240px 0px",
    threshold = 0,
    triggerOnce = true,
  } = options ?? {};
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  const ref = useCallback((nextNode: HTMLElement | null) => {
    setNode(nextNode);
  }, []);

  useEffect(() => {
    if (inView && triggerOnce) {
      return;
    }
    if (!node) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => {
        setInView(true);
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0);
        if (visible) {
          setInView(true);
          if (triggerOnce) {
            observer.disconnect();
          }
          return;
        }
        if (!triggerOnce) {
          setInView(false);
        }
      },
      { root: null, rootMargin, threshold },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [inView, node, rootMargin, threshold, triggerOnce]);

  return { ref, inView };
}
