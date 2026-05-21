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
          "neon-cta border-primary/32 bg-gradient-to-r from-primary via-primary-2 to-primary shadow-[0_0_10px_rgb(34_226_255_/_0.16)] hover:brightness-105 hover:shadow-[0_0_13px_rgb(34_226_255_/_0.18)]",
        secondary:
          "neon-tile border-primary/28 text-foreground hover:border-primary/40 hover:text-white hover:shadow-[0_0_10px_rgb(34_226_255_/_0.09)]",
        ghost:
          "text-muted hover:border-primary/22 hover:bg-primary/10 hover:text-white hover:shadow-[0_0_8px_rgb(34_226_255_/_0.08)]",
        danger:
          "neon-cta-danger border-danger/38 bg-danger/82 shadow-[0_0_10px_rgb(248_113_113_/_0.16)] hover:bg-danger",
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
