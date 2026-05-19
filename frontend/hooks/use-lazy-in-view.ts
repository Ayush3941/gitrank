"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const nodeRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    if (inView && triggerOnce) {
      return;
    }
    const node = nodeRef.current;
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
  }, [inView, rootMargin, threshold, triggerOnce]);

  return { ref, inView };
}
