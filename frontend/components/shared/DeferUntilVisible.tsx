"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export function DeferUntilVisible({
  children,
  fallback,
  rootMargin = "320px 0px",
  className,
}: {
  children: ReactNode;
  fallback: ReactNode;
  rootMargin?: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const userAgent = window.navigator?.userAgent?.toLowerCase() ?? "";
    const isJsdomRuntime = userAgent.includes("jsdom");
    return isJsdomRuntime || !("IntersectionObserver" in window);
  });

  useEffect(() => {
    if (isVisible) {
      return;
    }
    const node = hostRef.current;
    if (!node) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        setIsVisible(true);
        observer.disconnect();
      },
      {
        root: null,
        rootMargin,
        threshold: 0.01,
      },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [isVisible, rootMargin]);

  return (
    <div ref={hostRef} className={className}>
      {isVisible ? children : fallback}
    </div>
  );
}
