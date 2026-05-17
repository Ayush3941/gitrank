import { GlowCard } from "@/components/shared/GlowCard";

export function RouteLoadingState({
  eyebrow,
  title,
  description,
  cardCount = 3,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cardCount?: number;
}) {
  const cards = Array.from({ length: Math.max(1, cardCount) });

  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <GlowCard className="space-y-4">
        <p className="text-xs tracking-[0.24em] text-primary uppercase">{eyebrow}</p>
        <h1 className="text-3xl font-semibold text-white">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">{description}</p>
      </GlowCard>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((_, index) => (
          <GlowCard key={`route-loading-${index}`} className="space-y-3">
            <div className="neon-skeleton h-5 w-32 rounded-full" />
            <div className="neon-skeleton h-10 w-24 rounded-full" />
            <div className="neon-skeleton h-4 w-full rounded-full" />
            <div className="neon-skeleton h-4 w-4/5 rounded-full" />
          </GlowCard>
        ))}
      </div>
    </div>
  );
}
