"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "focus-ring neon-track relative h-7 w-12 rounded-full transition data-[state=checked]:border-primary/42 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary/40 data-[state=checked]:to-primary-2/40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-gradient-to-r from-cyan-100 via-cyan-200 to-fuchsia-200 shadow-[0_0_18px_rgb(34_226_255_/_0.38)] transition data-[state=checked]:translate-x-6" />
    </SwitchPrimitive.Root>
  );
}
