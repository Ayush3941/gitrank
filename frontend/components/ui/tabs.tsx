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
  return (
    <TabsPrimitive.List
      className={cn(
        "glass-panel cyber-frame inline-flex h-auto flex-wrap gap-2 rounded-3xl border border-primary/22 p-1.5 shadow-[0_0_12px_rgb(34_226_255_/_0.08)]",
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
        "focus-ring rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-muted hover:border-primary/22 hover:text-foreground data-[state=active]:border-primary/32 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary-2 data-[state=active]:text-background data-[state=active]:shadow-[0_0_8px_rgb(34_226_255_/_0.14)]",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;
