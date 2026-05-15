import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-transparent font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-gradient-to-r from-primary via-primary-2 to-primary text-background shadow-[0_0_30px_rgb(34_226_255_/_0.46)] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_0_40px_rgb(34_226_255_/_0.55)]",
        secondary:
          "neon-tile border-primary/32 text-foreground hover:border-primary/52 hover:text-white",
        ghost:
          "text-muted hover:border-primary/24 hover:bg-primary/10 hover:text-foreground hover:shadow-[0_0_26px_rgb(34_226_255_/_0.14)]",
        danger:
          "border-danger/38 bg-danger/82 text-white shadow-[0_0_24px_rgb(248_113_113_/_0.26)] hover:-translate-y-0.5 hover:bg-danger",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 rounded-2xl",
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
