import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 rounded-[0.1rem] border border-transparent font-medium disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "neon-cta border-primary/34 bg-gradient-to-r from-primary via-primary-2 to-primary shadow-[0_0_12px_rgb(34_226_255_/_0.2)] hover:brightness-105 hover:shadow-[0_0_16px_rgb(34_226_255_/_0.24)]",
        secondary:
          "neon-tile border-primary/32 text-foreground hover:border-primary/48 hover:text-white hover:shadow-[0_0_14px_rgb(34_226_255_/_0.12)]",
        ghost:
          "text-muted hover:border-primary/24 hover:bg-primary/10 hover:text-white hover:shadow-[0_0_12px_rgb(34_226_255_/_0.1)]",
        danger:
          "neon-cta-danger border-danger/40 bg-danger/82 shadow-[0_0_12px_rgb(248_113_113_/_0.18)] hover:bg-danger",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 rounded-[0.1rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  asChild,
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
