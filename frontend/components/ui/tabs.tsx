"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "glass-panel inline-flex h-auto flex-wrap gap-2 rounded-3xl border border-primary/26 p-1.5 shadow-[0_0_34px_rgb(34_226_255_/_0.14)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "focus-ring rounded-full border border-transparent px-4 py-2 text-sm font-medium text-muted transition hover:border-primary/24 hover:text-foreground data-[state=active]:border-primary/35 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary-2 data-[state=active]:text-background data-[state=active]:shadow-[0_0_24px_rgb(34_226_255_/_0.38)]",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;
