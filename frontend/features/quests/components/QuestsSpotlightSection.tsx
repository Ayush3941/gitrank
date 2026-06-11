"use client";

import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Route,
} from "lucide-react";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  formatQuestProgressLabel,
  questProgressPercent,
} from "@/features/quests/lib/quest-spotlight";
import { formatSignedXp } from "@/lib/formatters";
import type { Quest } from "@/types/gitrank";

export function QuestsSpotlightSection({
  dailyQuest,
  weeklyQuest,
  longTermQuest,
  isLoading,
  isError,
}: {
  dailyQuest: Quest | null;
  weeklyQuest: Quest | null;
  longTermQuest: Quest | null;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <section id="quests-spotlight" data-scroll-target="true" className="render-opt-section">
      {!isLoading && !isError ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Mission spotlight</h2>
          <ul role="list" className="grid gap-3 md:grid-cols-3">
            <MissionSpotlightCard
              kind="daily"
              title="Today's Quest"
              quest={dailyQuest}
              emptyCopy="No daily mission yet."
              href="/dashboard/contributions"
              cta="Open contributions"
            />
            <MissionSpotlightCard
              kind="weekly"
              title="Weekly Challenge"
              quest={weeklyQuest}
              emptyCopy="No weekly challenge yet."
              href="/dashboard/settings"
              cta="Open sync settings"
            />
            <MissionSpotlightCard
              kind="long-term"
              title="Long-Term Journey"
              quest={longTermQuest}
              emptyCopy="No long-term objective yet."
              href="/dashboard/contributions"
              cta="Keep building"
            />
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function recoveryHrefForGroup(group: Quest["cadence"]): string {
  if (group === "Long-term") {
    return "/dashboard/settings";
  }
  return "/dashboard/contributions";
}

function recoveryLabelForGroup(group: Quest["cadence"]): string {
  if (group === "Long-term") {
    return "Refresh sync settings";
  }
  if (group === "Skill-based") {
    return "Inspect contribution skills";
  }
  return "Open contributions";
}

function MissionSpotlightCard({
  kind,
  title,
  quest,
  emptyCopy,
  href,
  cta,
}: {
  kind: "daily" | "weekly" | "long-term";
  title: string;
  quest: Quest | null;
  emptyCopy: string;
  href: string;
  cta: string;
}) {
  const iconTone =
    kind === "daily"
      ? "text-cyan-200"
      : kind === "weekly"
        ? "text-violet-200"
        : "text-emerald-200";
  const Icon =
    kind === "daily"
      ? CalendarClock
      : kind === "weekly"
        ? CalendarDays
        : Route;
  if (!quest) {
    return (
      <li className="list-none">
        <div className="neon-surface space-y-3 border-dashed border-primary/24 px-4 py-4">
          <p className={`inline-flex items-center gap-2 text-xs font-medium ${iconTone}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {title}
          </p>
          <p className="text-sm text-muted">{emptyCopy}</p>
          <Button asChild variant="secondary" size="sm">
            <IntentPrefetchLink href={href}>
              {cta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </IntentPrefetchLink>
          </Button>
        </div>
      </li>
    );
  }

  const progress = questProgressPercent(quest);
  const statusMeta = questStatusMeta(quest.status);

  return (
    <li className="list-none">
      <div className="neon-surface space-y-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`inline-flex items-center gap-2 text-xs font-medium ${iconTone}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {title}
            </p>
            <p className="mt-2 text-base font-semibold text-white">{quest.title}</p>
            <span className={statusMeta.className}>
              {statusMeta.label}
            </span>
          </div>
          <span className="neon-chip neon-chip-info rounded-full px-2.5 py-1 text-xs font-semibold">
            <span className="numeric-readout">{formatSignedXp(quest.rewardXp)}</span>
          </span>
        </div>
        <p className="text-sm text-muted">{quest.description}</p>
        <div className="space-y-1">
          <Progress value={progress} aria-label={`${quest.title} quest progress`} />
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="numeric-readout">{formatQuestProgressLabel(quest)}</span>
            <span className="numeric-readout">{progress}%</span>
          </div>
        </div>
        <p className="text-xs text-cyan-100">
          Next move: {recoveryLabelForGroup(quest.cadence)}
        </p>
        <Button asChild variant="secondary" size="sm">
          <IntentPrefetchLink href={recoveryHrefForGroup(quest.cadence)}>
            {recoveryLabelForGroup(quest.cadence)}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </IntentPrefetchLink>
        </Button>
      </div>
    </li>
  );
}

function questStatusMeta(status: Quest["status"]): { label: string; className: string } {
  if (status === "Completed") {
    return {
      label: "Completed",
      className: "mt-2 inline-flex neon-chip neon-chip-success rounded-full px-2.5 py-1 text-xs font-semibold",
    };
  }
  if (status === "Locked") {
    return {
      label: "Locked",
      className: "mt-2 inline-flex neon-chip neon-chip-warning rounded-full px-2.5 py-1 text-xs font-semibold",
    };
  }
  return {
    label: "Active",
    className: "mt-2 inline-flex neon-chip neon-chip-info rounded-full px-2.5 py-1 text-xs font-semibold",
  };
}
