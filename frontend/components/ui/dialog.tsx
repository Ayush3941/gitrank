"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,rgba(34,226,255,0.08),rgba(0,0,0,0.9))]" />
      <DialogPrimitive.Content
        className={cn(
          "glass-panel-strong cyber-card fixed top-1/2 left-1/2 z-50 max-h-[min(90vh,44rem)] w-[min(92vw,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6 shadow-2xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="focus-ring neon-tile absolute top-4 right-4 rounded-full p-2 text-muted hover:text-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
