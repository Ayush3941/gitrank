"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

export function DeferUntilVisible({
  children,
  fallback = null,
  rootMargin = "220px 0px",
  className,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const isTestEnvironment =
    typeof process !== "undefined" && process.env.NODE_ENV === "test";
  const supportsIntersectionObserver =
    typeof window !== "undefined" &&
    typeof window.IntersectionObserver === "function";

  useEffect(() => {
    if (visible || isTestEnvironment || !supportsIntersectionObserver) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          setVisible(true);
          observer.disconnect();
          return;
        }
      },
      {
        rootMargin,
        threshold: 0.01,
      },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [isTestEnvironment, rootMargin, supportsIntersectionObserver, visible]);

  if (isTestEnvironment || !supportsIntersectionObserver) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={className}>
      {visible ? children : fallback}
    </div>
  );
}
