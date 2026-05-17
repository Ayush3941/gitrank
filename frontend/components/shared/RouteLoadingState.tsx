import { GlowCard } from "@/components/shared/GlowCard";

export function RouteLoadingState({
  eyebrow,
  title,
  description,
  cardCount = 3,
  variant = "default",
}: {
  eyebrow: string;
  title: string;
  description: string;
  cardCount?: number;
  variant?: "default" | "dashboard" | "marketing" | "profile" | "report";
}) {
  const cards = Array.from({ length: Math.max(1, cardCount) });

  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <GlowCard className="space-y-4">
        <p className="text-xs tracking-[0.24em] text-primary uppercase">{eyebrow}</p>
        <h1 className="text-3xl font-semibold text-white">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">{description}</p>
      </GlowCard>
      {variant === "dashboard" ? <DashboardLoadingGrid cards={cards} /> : null}
      {variant === "marketing" ? <MarketingLoadingGrid cards={cards} /> : null}
      {variant === "profile" ? <ProfileLoadingGrid cards={cards} /> : null}
      {variant === "report" ? <ReportLoadingGrid cards={cards} /> : null}
      {variant === "default" ? <DefaultLoadingGrid cards={cards} /> : null}
    </div>
  );
}

function DefaultLoadingGrid({ cards }: { cards: unknown[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((_, index) => (
        <GlowCard key={`route-loading-default-${index}`} className="space-y-3">
          <div className="neon-skeleton h-5 w-32 rounded-full" />
          <div className="neon-skeleton h-10 w-24 rounded-full" />
          <div className="neon-skeleton h-4 w-full rounded-full" />
          <div className="neon-skeleton h-4 w-4/5 rounded-full" />
        </GlowCard>
      ))}
    </div>
  );
}

function DashboardLoadingGrid({ cards }: { cards: unknown[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <GlowCard className="space-y-4">
          <div className="neon-skeleton h-6 w-40 rounded-full" />
          <div className="neon-skeleton h-12 w-3/5 rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="neon-skeleton h-20 rounded-[1.2rem]" />
            <div className="neon-skeleton h-20 rounded-[1.2rem]" />
            <div className="neon-skeleton h-20 rounded-[1.2rem]" />
          </div>
          <div className="neon-skeleton h-4 w-full rounded-full" />
          <div className="neon-skeleton h-4 w-4/5 rounded-full" />
        </GlowCard>
        <GlowCard className="space-y-3">
          <div className="neon-skeleton h-6 w-36 rounded-full" />
          <div className="neon-skeleton h-24 rounded-[1.2rem]" />
          <div className="neon-skeleton h-24 rounded-[1.2rem]" />
          <div className="neon-skeleton h-24 rounded-[1.2rem]" />
        </GlowCard>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.slice(0, 3).map((_, index) => (
          <GlowCard key={`route-loading-dashboard-${index}`} className="space-y-3">
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

function MarketingLoadingGrid({ cards }: { cards: unknown[] }) {
  return (
    <div className="space-y-4">
      <GlowCard className="space-y-4">
        <div className="neon-skeleton h-6 w-40 rounded-full" />
        <div className="neon-skeleton h-12 w-4/5 rounded-xl" />
        <div className="neon-skeleton h-5 w-3/4 rounded-full" />
        <div className="flex flex-wrap gap-3">
          <div className="neon-skeleton h-9 w-40 rounded-full" />
          <div className="neon-skeleton h-9 w-36 rounded-full" />
        </div>
      </GlowCard>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((_, index) => (
          <GlowCard key={`route-loading-marketing-${index}`} className="space-y-3">
            <div className="neon-skeleton h-9 w-9 rounded-xl" />
            <div className="neon-skeleton h-6 w-3/4 rounded-full" />
            <div className="neon-skeleton h-4 w-full rounded-full" />
            <div className="neon-skeleton h-4 w-5/6 rounded-full" />
          </GlowCard>
        ))}
      </div>
    </div>
  );
}

function ProfileLoadingGrid({ cards }: { cards: unknown[] }) {
  return (
    <div className="space-y-4">
      <GlowCard className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="neon-skeleton h-20 w-20 rounded-[1.4rem]" />
          <div className="space-y-2">
            <div className="neon-skeleton h-6 w-56 rounded-full" />
            <div className="neon-skeleton h-4 w-40 rounded-full" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="neon-skeleton h-16 rounded-[1rem]" />
          <div className="neon-skeleton h-16 rounded-[1rem]" />
          <div className="neon-skeleton h-16 rounded-[1rem]" />
        </div>
      </GlowCard>
      <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <GlowCard className="space-y-3">
          <div className="neon-skeleton h-5 w-44 rounded-full" />
          <div className="neon-skeleton h-52 rounded-[1.2rem]" />
        </GlowCard>
        <GlowCard className="space-y-3">
          {cards.slice(0, 3).map((_, index) => (
            <div key={`route-loading-profile-${index}`} className="neon-skeleton h-20 rounded-[1rem]" />
          ))}
        </GlowCard>
      </div>
    </div>
  );
}

function ReportLoadingGrid({ cards }: { cards: unknown[] }) {
  return (
    <div className="space-y-4">
      <GlowCard className="space-y-4">
        <div className="neon-skeleton h-5 w-56 rounded-full" />
        <div className="neon-skeleton h-10 w-4/5 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="neon-skeleton h-16 rounded-[1rem]" />
          <div className="neon-skeleton h-16 rounded-[1rem]" />
          <div className="neon-skeleton h-16 rounded-[1rem]" />
        </div>
      </GlowCard>
      <div className="grid gap-4 xl:grid-cols-2">
        <GlowCard className="space-y-3">
          {cards.slice(0, 2).map((_, index) => (
            <div key={`route-loading-report-left-${index}`} className="neon-skeleton h-28 rounded-[1rem]" />
          ))}
        </GlowCard>
        <GlowCard className="space-y-3">
          {cards.slice(2, 4).map((_, index) => (
            <div key={`route-loading-report-right-${index}`} className="neon-skeleton h-28 rounded-[1rem]" />
          ))}
        </GlowCard>
      </div>
    </div>
  );
}
