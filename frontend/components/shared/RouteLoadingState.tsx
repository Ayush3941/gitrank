import { GlowCard } from "@/components/shared/GlowCard";
import { formatLoadingAnnouncement } from "@/lib/presentation/loading-copy";
import { shouldShowHeaderEyebrow } from "@/lib/presentation/header-eyebrow";

type LoadingCardRow = {
  id: string;
};

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
  const cards = buildLoadingCardRows("route-loading-card", cardCount);
  const showEyebrow = shouldShowHeaderEyebrow(eyebrow, title);
  const announcement = formatLoadingAnnouncement(title, description);

  return (
    <div className="space-y-6" aria-busy="true">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <GlowCard variant="loading" className="space-y-4">
        {showEyebrow ? <p className="text-xs font-medium text-primary">{eyebrow}</p> : null}
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

function DefaultLoadingGrid({ cards }: { cards: LoadingCardRow[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <GlowCard variant="loading" key={`route-loading-default-${card.id}`} className="space-y-3">
          <div className="neon-skeleton h-5 w-32 rounded-full" />
          <div className="neon-skeleton h-10 w-24 rounded-full" />
          <div className="neon-skeleton h-4 w-full rounded-full" />
        </GlowCard>
      ))}
    </div>
  );
}

function DashboardLoadingGrid({ cards }: { cards: LoadingCardRow[] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <GlowCard variant="loading" className="space-y-4">
          <div className="neon-skeleton h-6 w-40 rounded-full" />
          <div className="neon-skeleton h-10 w-3/5 rounded-[var(--radius-universal)]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="neon-skeleton h-20 rounded-[var(--radius-universal)]" />
            <div className="neon-skeleton h-20 rounded-[var(--radius-universal)]" />
          </div>
          <div className="neon-skeleton h-4 w-full rounded-full" />
        </GlowCard>
        <GlowCard variant="loading" className="space-y-3">
          <div className="neon-skeleton h-6 w-36 rounded-full" />
          <div className="neon-skeleton h-24 rounded-[var(--radius-universal)]" />
          <div className="neon-skeleton h-24 rounded-[var(--radius-universal)]" />
        </GlowCard>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.slice(0, 2).map((card) => (
          <GlowCard variant="loading" key={`route-loading-dashboard-${card.id}`} className="space-y-3">
            <div className="neon-skeleton h-5 w-32 rounded-full" />
            <div className="neon-skeleton h-10 w-24 rounded-full" />
            <div className="neon-skeleton h-4 w-full rounded-full" />
          </GlowCard>
        ))}
      </div>
    </div>
  );
}

function MarketingLoadingGrid({ cards }: { cards: LoadingCardRow[] }) {
  return (
    <div className="space-y-4">
      <GlowCard variant="loading" className="space-y-4">
        <div className="neon-skeleton h-6 w-40 rounded-full" />
        <div className="neon-skeleton h-12 w-4/5 rounded-[var(--radius-universal)]" />
        <div className="neon-skeleton h-5 w-3/4 rounded-full" />
        <div className="flex flex-wrap gap-3">
          <div className="neon-skeleton h-9 w-44 rounded-full" />
        </div>
      </GlowCard>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.slice(0, 2).map((card) => (
          <GlowCard variant="loading" key={`route-loading-marketing-${card.id}`} className="space-y-3">
            <div className="neon-skeleton h-9 w-9 rounded-[var(--radius-universal)]" />
            <div className="neon-skeleton h-6 w-3/4 rounded-full" />
            <div className="neon-skeleton h-4 w-full rounded-full" />
          </GlowCard>
        ))}
      </div>
    </div>
  );
}

function ProfileLoadingGrid({ cards }: { cards: LoadingCardRow[] }) {
  return (
    <div className="space-y-4">
      <GlowCard variant="loading" className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="neon-skeleton h-20 w-20 rounded-[var(--radius-universal)]" />
          <div className="space-y-2">
            <div className="neon-skeleton h-6 w-56 rounded-full" />
            <div className="neon-skeleton h-4 w-40 rounded-full" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="neon-skeleton h-16 rounded-[var(--radius-universal)]" />
          <div className="neon-skeleton h-16 rounded-[var(--radius-universal)]" />
        </div>
      </GlowCard>
      <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <GlowCard variant="loading" className="space-y-3">
          <div className="neon-skeleton h-5 w-44 rounded-full" />
          <div className="neon-skeleton h-52 rounded-[var(--radius-universal)]" />
        </GlowCard>
        <GlowCard variant="loading" className="space-y-3">
          {cards.slice(0, 2).map((card) => (
            <div key={`route-loading-profile-${card.id}`} className="neon-skeleton h-20 rounded-[var(--radius-universal)]" />
          ))}
        </GlowCard>
      </div>
    </div>
  );
}

function ReportLoadingGrid({ cards }: { cards: LoadingCardRow[] }) {
  return (
    <div className="space-y-4">
      <GlowCard variant="loading" className="space-y-4">
        <div className="neon-skeleton h-5 w-56 rounded-full" />
        <div className="neon-skeleton h-10 w-4/5 rounded-[var(--radius-universal)]" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="neon-skeleton h-16 rounded-[var(--radius-universal)]" />
          <div className="neon-skeleton h-16 rounded-[var(--radius-universal)]" />
        </div>
      </GlowCard>
      <div className="grid gap-4 xl:grid-cols-2">
        <GlowCard variant="loading" className="space-y-3">
          {cards.slice(0, 1).map((card) => (
            <div key={`route-loading-report-left-${card.id}`} className="neon-skeleton h-28 rounded-[var(--radius-universal)]" />
          ))}
        </GlowCard>
        <GlowCard variant="loading" className="space-y-3">
          {cards.slice(1, 2).map((card) => (
            <div key={`route-loading-report-right-${card.id}`} className="neon-skeleton h-28 rounded-[var(--radius-universal)]" />
          ))}
        </GlowCard>
      </div>
    </div>
  );
}

function buildLoadingCardRows(prefix: string, count: number): LoadingCardRow[] {
  return Array.from({ length: Math.max(1, count) }, (_unused, offset) => ({
    id: `${prefix}-${offset + 1}`,
  }));
}
