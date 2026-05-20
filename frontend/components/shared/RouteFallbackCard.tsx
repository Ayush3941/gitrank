import Link from "next/link";
import { cn } from "@/lib/cn";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

type RouteFallbackAction = {
  label: string;
  href: string;
  variant?: "default" | "secondary" | "ghost" | "danger";
};

export function RouteFallbackCard({
  eyebrow,
  title,
  description,
  actions,
  centered = false,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions: RouteFallbackAction[];
  centered?: boolean;
  className?: string;
}) {
  return (
    <GlowCard
      strong
      className={cn(
        "space-y-4",
        centered ? "w-full max-w-2xl text-center" : "",
        className,
      )}
    >
      <p className="text-xs font-medium text-primary">{eyebrow}</p>
      <h1 className="text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
      <p className={cn("text-sm text-muted sm:text-base", centered ? "mx-auto max-w-xl" : "max-w-2xl")}>
        {description}
      </p>
      <div className={cn("flex flex-wrap gap-3", centered ? "items-center justify-center" : "")}>
        {actions.map((action) => (
          <Button key={action.href} asChild variant={action.variant ?? "secondary"}>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </div>
    </GlowCard>
  );
}
