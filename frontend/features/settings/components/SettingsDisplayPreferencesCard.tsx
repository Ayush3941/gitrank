"use client";

import { useEffect, useId, useState } from "react";
import { Palette } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { GlowCard } from "@/components/shared/GlowCard";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { TextScalePreference } from "@/hooks/use-text-scale-preference";
import type {
  ThemePreference,
  ThemePreferenceSource,
} from "@/hooks/use-theme-preference";

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  swatchClassName: string;
}> = [
  {
    value: "neon",
    label: "Neon grid",
    description: "Bold glow and vivid HUD accents.",
    swatchClassName: "from-cyan-300 via-fuchsia-300 to-emerald-300",
  },
  {
    value: "cyberpunk",
    label: "Cyberpunk matrix",
    description: "Pink highlights, amber rails, dark steel surfaces.",
    swatchClassName: "from-pink-300 via-orange-300 to-lime-300",
  },
  {
    value: "midnight",
    label: "Midnight contrast",
    description: "Balanced readability on dark surfaces.",
    swatchClassName: "from-sky-300 via-indigo-300 to-violet-300",
  },
  {
    value: "terminal",
    label: "Terminal pulse",
    description: "Sharper terminal-style contrast.",
    swatchClassName: "from-emerald-200 via-teal-200 to-fuchsia-300",
  },
  {
    value: "aurora",
    label: "Aurora clarity",
    description: "Softer glow with stronger text contrast.",
    swatchClassName: "from-teal-200 via-cyan-200 to-blue-300",
  },
  {
    value: "high-contrast",
    label: "High contrast",
    description: "Maximum text clarity with low visual noise.",
    swatchClassName: "from-slate-100 via-cyan-200 to-slate-100",
  },
];

const TEXT_SCALE_OPTIONS: Array<{
  value: TextScalePreference;
  label: string;
  description: string;
}> = [
  {
    value: "default",
    label: "Default text",
    description: "Balanced density at standard UI scale.",
  },
  {
    value: "large",
    label: "Large text",
    description: "Larger body and UI text.",
  },
];

export function SettingsDisplayPreferencesCard({
  reducedGamification,
  isSaving,
  displayShortcutsEnabled,
  theme,
  themeSource,
  textScale,
  onReducedGamificationChange,
  onDisplayShortcutsEnabledChange,
  onThemeChange,
  onClearThemePreference,
  onTextScaleChange,
}: {
  reducedGamification: boolean;
  isSaving: boolean;
  displayShortcutsEnabled: boolean;
  theme: ThemePreference;
  themeSource: ThemePreferenceSource;
  textScale: TextScalePreference;
  onReducedGamificationChange: (checked: boolean) => void;
  onDisplayShortcutsEnabledChange: (enabled: boolean) => void;
  onThemeChange: (theme: ThemePreference) => void;
  onClearThemePreference: () => void;
  onTextScaleChange: (textScale: TextScalePreference) => void;
}) {
  const [displayNotice, setDisplayNotice] = useState("");
  const [showDisplayTuning, setShowDisplayTuning] = useState(false);
  const displayTuningToggleId = useId();
  const displayTuningPanelId = useId();
  const activeTheme = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
  const activeTextScale =
    TEXT_SCALE_OPTIONS.find((option) => option.value === textScale) ?? TEXT_SCALE_OPTIONS[0];

  useEffect(() => {
    if (!displayNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDisplayNotice("");
    }, 4200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [displayNotice]);

  function handleResetDisplayPreferences() {
    onClearThemePreference();
    onTextScaleChange("default");
    setDisplayNotice(
      "Display preferences reset. Theme now follows your system theme preference and text scale is Default.",
    );
  }

  return (
    <GlowCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex rounded-[var(--radius-universal)] bg-primary/12 p-3 text-primary">
            <BrandLogo size={20} className="h-5 w-5" />
          </div>
          <p className="mt-4 text-xs font-medium text-primary">Display preference</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Reduced gamification</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Reduce visual effects. Scores and privacy stay unchanged.
          </p>
        </div>
        <Switch
          id="reduced-gamification"
          aria-label="Reduced gamification"
          checked={reducedGamification}
          disabled={isSaving}
          onCheckedChange={onReducedGamificationChange}
        />
      </div>
      <div className="cyber-divider" />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-primary">Keyboard controls</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Display shortcuts</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Enable theme and text-size shortcuts outside text inputs.
            </p>
          </div>
          <Switch
            id="display-shortcuts-enabled"
            aria-label="Enable display shortcuts"
            checked={displayShortcutsEnabled}
            onCheckedChange={onDisplayShortcutsEnabledChange}
          />
        </div>
        <div className="cyber-divider" />
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-white">Theme + text tuning</p>
          </div>
          <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {activeTheme.label} / {activeTextScale.label} / {themeSource === "system" ? "System" : "Manual"}
              </p>
              <DisclosureToggle
                id={displayTuningToggleId}
                controlsId={displayTuningPanelId}
                expanded={showDisplayTuning}
                onToggle={() => {
                  setShowDisplayTuning((current) => !current);
                }}
                collapsedLabel="Display tuning"
                expandedLabel="Hide tuning"
                iconClassName="h-4 w-4"
              />
            </div>
          </div>
          <div
            id={displayTuningPanelId}
            role="region"
            aria-labelledby={displayTuningToggleId}
            hidden={!showDisplayTuning}
            className="space-y-4"
          >
            <div className="space-y-3">
              <p className="text-xs font-medium text-primary">Visual theme</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {THEME_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={theme === option.value ? "default" : "secondary"}
                    className="h-auto justify-between px-4 py-3 text-left"
                    onClick={() => onThemeChange(option.value)}
                    aria-pressed={theme === option.value}
                  >
                    <span className="flex flex-col items-start gap-1">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`h-2.5 w-5 rounded-full bg-gradient-to-r ${option.swatchClassName}`}
                          aria-hidden="true"
                        />
                        <span>{option.label}</span>
                      </span>
                      <span className="text-xs text-muted">{option.description}</span>
                    </span>
                    {theme === option.value ? (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-300/18 px-2 py-0.5 text-xs font-semibold text-emerald-50">
                        Active
                      </span>
                    ) : null}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="justify-start"
                onClick={onClearThemePreference}
                disabled={themeSource === "system"}
              >
                {themeSource === "system" ? "Following system theme" : "Follow system theme"}
              </Button>
            </div>
            <div className="cyber-divider" />
            <div className="space-y-3">
              <p className="text-xs font-medium text-primary">Text scale</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEXT_SCALE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={textScale === option.value ? "default" : "secondary"}
                    className="h-auto justify-between px-4 py-3 text-left"
                    onClick={() => onTextScaleChange(option.value)}
                    aria-pressed={textScale === option.value}
                  >
                    <span className="flex flex-col items-start">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted">{option.description}</span>
                    </span>
                    {textScale === option.value ? (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-300/18 px-2 py-0.5 text-xs font-semibold text-emerald-50">
                        Active
                      </span>
                    ) : null}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="justify-start"
                onClick={handleResetDisplayPreferences}
              >
                Reset display preferences
              </Button>
            </div>
          </div>
        </div>
        <InlineNotice
          message={displayNotice}
          placeholder="Display update"
          variant="info"
          minHeightClassName="min-h-7"
          onDismiss={() => {
            setDisplayNotice("");
          }}
          dismissLabel="Dismiss display update"
        />
      </div>
    </GlowCard>
  );
}
