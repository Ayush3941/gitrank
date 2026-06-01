"use client";

import Link, { type LinkProps } from "next/link";
import { type AnchorHTMLAttributes, type ReactNode, useState } from "react";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";

type IntentPrefetchLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
    prefetchMode?: "intent" | "never";
  };

export function IntentPrefetchLink({
  prefetchMode = "intent",
  onMouseEnter,
  onFocus,
  onTouchStart,
  children,
  ...rest
}: IntentPrefetchLinkProps) {
  const constrainedNetwork = useNetworkConstraintPreference();
  const [intentDetected, setIntentDetected] = useState(false);
  const shouldPrefetchOnIntent = !constrainedNetwork && prefetchMode === "intent";

  const prefetch = shouldPrefetchOnIntent
    ? (intentDetected ? null : false)
    : false;

  return (
    <Link
      {...rest}
      prefetch={prefetch}
      onMouseEnter={(event) => {
        if (shouldPrefetchOnIntent) {
          setIntentDetected(true);
        }
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        if (shouldPrefetchOnIntent) {
          setIntentDetected(true);
        }
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        if (shouldPrefetchOnIntent) {
          setIntentDetected(true);
        }
        onTouchStart?.(event);
      }}
    >
      {children}
    </Link>
  );
}
