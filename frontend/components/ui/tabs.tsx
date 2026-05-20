"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const listNode = listRef.current;
    if (!listNode || typeof window === "undefined") {
      return;
    }

    const scrollActiveTabIntoView = () => {
      const activeTab = listNode.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]',
      );
      if (!activeTab) {
        return;
      }
      const itemStart = activeTab.offsetLeft;
      const itemEnd = itemStart + activeTab.offsetWidth;
      const viewStart = listNode.scrollLeft;
      const viewEnd = viewStart + listNode.clientWidth;
      const itemAlreadyVisible = itemStart >= viewStart && itemEnd <= viewEnd;
      if (itemAlreadyVisible) {
        return;
      }
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const centeredLeft = Math.max(
        0,
        itemStart - (listNode.clientWidth - activeTab.offsetWidth) / 2,
      );
      listNode.scrollTo({
        left: centeredLeft,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    };

    // Run once on mount so preselected tabs in overflow rails are visible.
    scrollActiveTabIntoView();
    const observer = new MutationObserver((entries) => {
      for (const entry of entries) {
        if (
          entry.type === "attributes" &&
          entry.attributeName === "data-state"
        ) {
          scrollActiveTabIntoView();
          return;
        }
      }
    });
    observer.observe(listNode, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={listRef}
      className={cn(
        "glass-panel cyber-frame inline-flex h-auto flex-wrap gap-2 rounded-3xl border border-primary/26 p-1.5 shadow-[0_0_18px_rgb(34_226_255_/_0.1)]",
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "focus-ring rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-muted hover:border-primary/24 hover:text-foreground data-[state=active]:border-primary/35 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary-2 data-[state=active]:text-background data-[state=active]:shadow-[0_0_12px_rgb(34_226_255_/_0.18)]",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;
