"use client";

import { useMemo } from "react";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { toAbsoluteShareUrl } from "@/lib/share-links";

export function CopyLinkButton({
  href,
  label = "Copy link",
  copiedLabel = "Link copied",
  analyticsTarget = "copy-link",
  size = "sm",
  variant = "ghost",
}: {
  href: string;
  label?: string;
  copiedLabel?: string;
  analyticsTarget?: string;
  size?: "sm" | "md" | "lg" | "icon";
  variant?: "default" | "secondary" | "ghost" | "danger";
}) {
  const text = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    return toAbsoluteShareUrl(href, origin);
  }, [href]);

  return (
    <CopyTextButton
      text={text}
      label={label}
      copiedLabel={copiedLabel}
      analyticsTarget={analyticsTarget}
      size={size}
      variant={variant}
    />
  );
}
