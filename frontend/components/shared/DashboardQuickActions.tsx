"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDisplayShortcutsEnabled } from "@/hooks/use-display-shortcuts-enabled";
import { useTextScalePreference } from "@/hooks/use-text-scale-preference";
import { useThemePreference, type ThemePreference } from "@/hooks/use-theme-preference";
import { cn } from "@/lib/cn";
import {
  filterQuickActions,
  groupQuickActions,
  promoteRecentActions,
  type QuickActionItem,
} from "@/lib/quick-actions";

const THEME_ORDER: ThemePreference[] = ["neon", "midnight", "aurora", "high-contrast"];
const RECENT_ACTION_IDS_STORAGE_KEY = "gitrank:quick-actions-recent-ids";
const MAX_RECENT_ACTIONS = 5;

type DashboardQuickActionsProps = {
  username: string;
  onOpenShortcutsHelp?: () => void;
};

export function DashboardQuickActions({
  username,
  onOpenShortcutsHelp,
}: DashboardQuickActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { enabled: displayShortcutsEnabled } = useDisplayShortcutsEnabled();
  const { theme, setTheme } = useThemePreference();
  const { textScale, setTextScale } = useTextScalePreference();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [recentNonce, setRecentNonce] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim();
  const shortcutHint = "Ctrl/Cmd+K";

  const actions = useMemo<QuickActionItem[]>(() => {
    const routeActions = dashboardNavItems.map((item) => ({
      id: `goto:${item.href}`,
      group: "Navigate",
      label: `Go to ${item.label}`,
      description: `Open ${item.label.toLowerCase()} lane`,
      keywords: [item.label, item.mobileLabel, item.href.replace("/dashboard/", "")],
      shortcut: activeLaneShortcut(pathname, item.href),
      icon: item.icon,
      execute: () => {
        router.push(item.href);
      },
    }));

    const profileAction: QuickActionItem = {
      id: "profile:public",
      group: "Profile",
      label: "Open public profile",
      description: `View /u/${username} share card`,
      keywords: ["profile", "public", "share", username],
      icon: Sparkles,
      execute: () => {
        router.push(`/u/${encodeURIComponent(username)}`);
      },
    };

    const themeAction: QuickActionItem = {
      id: "theme:cycle",
      group: "Display",
      label: `Switch theme (${themeLabel(theme)})`,
      description: "Cycle among Neon, Midnight, Aurora, and High Contrast modes",
      keywords: ["theme", "contrast", "neon", "midnight", "aurora"],
      icon: ShieldCheck,
      shortcut: "Alt+Shift+T",
      execute: () => {
        setTheme(nextTheme(theme));
      },
    };

    const textAction: QuickActionItem = {
      id: "text:toggle",
      group: "Display",
      label: textScale === "large" ? "Use default text size" : "Use large text size",
      description: "Toggle readability scaling for dense dashboard surfaces",
      keywords: ["text", "size", "readability", "large", "default"],
      icon: Search,
      shortcut: "Alt+Shift+L",
      execute: () => {
        setTextScale(textScale === "large" ? "default" : "large");
      },
    };

    const shortcutsAction: QuickActionItem = {
      id: "help:shortcuts",
      group: "Help",
      label: "Open keyboard shortcuts help",
      description: "View all dashboard keyboard actions and discovery tips",
      keywords: ["help", "shortcuts", "keyboard", "question mark"],
      shortcut: "?",
      execute: () => {
        onOpenShortcutsHelp?.();
      },
    };

    return [
      ...routeActions,
      profileAction,
      themeAction,
      textAction,
      shortcutsAction,
    ];
  }, [
    onOpenShortcutsHelp,
    pathname,
    router,
    setTextScale,
    setTheme,
    textScale,
    theme,
    username,
  ]);

  const filteredActions = useMemo(
    () => filterQuickActions(actions, deferredQuery),
    [actions, deferredQuery],
  );
  const recentActionIds = useMemo(
    () => (open ? loadRecentActionIds(recentNonce) : []),
    [open, recentNonce],
  );
  const visibleActions = useMemo(() => {
    if (normalizedQuery.length > 0 || recentActionIds.length === 0) {
      return filteredActions;
    }
    return promoteRecentActions(filteredActions, recentActionIds, "Recent");
  }, [filteredActions, normalizedQuery.length, recentActionIds]);
  const groupedActions = useMemo(
    () => groupQuickActions(visibleActions),
    [visibleActions],
  );
  const clampedHighlightedIndex =
    visibleActions.length > 0
      ? Math.min(Math.max(highlightedIndex, 0), visibleActions.length - 1)
      : -1;
  const highlightedAction =
    clampedHighlightedIndex >= 0 ? visibleActions[clampedHighlightedIndex] : null;

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !highlightedAction) {
      return;
    }
    const node = document.getElementById(optionIdForAction(highlightedAction.id));
    node?.scrollIntoView({ block: "nearest" });
  }, [highlightedAction, open]);

  useEffect(() => {
    if (!displayShortcutsEnabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) {
        return;
      }
      if (event.key.toLowerCase() !== "k") {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      setOpen((current) => {
        const nextOpen = !current;
        if (nextOpen) {
          setHighlightedIndex(0);
        }
        return nextOpen;
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [displayShortcutsEnabled]);

  function executeAction(action: QuickActionItem) {
    recordRecentAction(action.id);
    setRecentNonce((value) => value + 1);
    action.execute();
    setOpen(false);
    setQuery("");
    setHighlightedIndex(0);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!visibleActions.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % visibleActions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => {
        if (current <= 0) {
          return visibleActions.length - 1;
        }
        return current - 1;
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const action = highlightedAction ?? visibleActions[0];
      if (action) {
        executeAction(action);
      }
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setHighlightedIndex(0);
          setOpen(true);
        }}
        className="gap-2"
      >
        Quick actions
        <kbd className="hidden text-[11px] sm:inline">⌘/Ctrl K</kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          setHighlightedIndex(0);
          if (!nextOpen) {
            setQuery("");
          }
        }}
      >
        <DialogContent className="w-[min(94vw,42rem)] p-4 sm:p-5">
          <div className="space-y-1">
            <DialogTitle className="text-xl text-white">Quick actions</DialogTitle>
            <DialogDescription className="text-sm text-slate-200">
              Jump across dashboard lanes, trigger sync, and tune display in one keyboard-first surface.
            </DialogDescription>
          </div>
          <div className="neon-tile flex items-center gap-2 rounded-[0.1rem] px-3 py-2">
            <Search className="h-4 w-4 text-cyan-200" />
            <input
              ref={inputRef}
              role="combobox"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Type an action, route, or keyword..."
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-300 focus:outline-none"
              aria-label="Search quick actions"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-controls="dashboard-quick-actions-list"
              aria-activedescendant={highlightedAction ? optionIdForAction(highlightedAction.id) : undefined}
            />
            <span className="text-[11px] tracking-[0.12em] text-cyan-200 uppercase">{shortcutHint}</span>
          </div>
          {!displayShortcutsEnabled ? (
            <p className="text-xs text-amber-100">
              Display shortcuts are disabled in Settings, so <span className="text-white">Alt+Shift+T/L</span> are off.
            </p>
          ) : null}
          {normalizedQuery.length === 0 && recentActionIds.length > 0 ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  clearRecentActionIds();
                  setRecentNonce((value) => value + 1);
                }}
              >
                Clear recent
              </Button>
            </div>
          ) : null}
          <div
            id="dashboard-quick-actions-list"
            role="listbox"
            aria-label="Quick action results"
            className="max-h-[50vh] space-y-3 overflow-auto pr-1"
          >
            {groupedActions.length > 0 ? (
              groupedActions.map((group) => (
                <section key={group.title} className="space-y-2">
                  <p className="px-1 text-[11px] tracking-[0.14em] text-cyan-200 uppercase">
                    {group.title}
                  </p>
                  <div className="space-y-2">
                    {group.items.map((action) => {
                      const Icon = action.icon;
                      const index = visibleActions.findIndex((entry) => entry.id === action.id);
                      const highlighted = index === clampedHighlightedIndex;
                      return (
                        <button
                          key={action.id}
                          id={optionIdForAction(action.id)}
                          type="button"
                          role="option"
                          aria-selected={highlighted}
                          onMouseEnter={() => {
                            if (index >= 0) {
                              setHighlightedIndex(index);
                            }
                          }}
                          onClick={() => {
                            executeAction(action);
                          }}
                          className={cn(
                            "focus-ring neon-tile w-full border px-3 py-2.5 text-left transition",
                            highlighted && "border-primary/48 bg-primary/10 shadow-[0_0_20px_rgb(34_226_255_/_0.15)]",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                              {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
                              {highlighted ? "↵ " : ""}
                              {action.label}
                            </span>
                            {action.shortcut ? (
                              <kbd className="text-[11px]">{action.shortcut}</kbd>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-200">{action.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="neon-tile rounded-[0.1rem] border border-dashed border-primary/30 px-3 py-3 text-sm text-slate-200">
                No matching action. Try route names like <span className="text-white">contributions</span> or <span className="text-white">settings</span>.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function nextTheme(current: ThemePreference): ThemePreference {
  const currentIndex = THEME_ORDER.indexOf(current);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  return THEME_ORDER[(safeIndex + 1) % THEME_ORDER.length];
}

function themeLabel(theme: ThemePreference): string {
  if (theme === "neon") {
    return "Neon";
  }
  if (theme === "aurora") {
    return "Aurora";
  }
  if (theme === "high-contrast") {
    return "High contrast";
  }
  return "Midnight";
}

function activeLaneShortcut(pathname: string, href: string) {
  if (pathname === href || pathname.startsWith(`${href}/`)) {
    return "Current";
  }
  return undefined;
}

function optionIdForAction(actionId: string) {
  return `dashboard-quick-action-${actionId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox'], [aria-multiline='true']",
    ),
  );
}

function loadRecentActionIds(_refresh = 0) {
  void _refresh;
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(RECENT_ACTION_IDS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function recordRecentAction(actionId: string) {
  if (typeof window === "undefined") {
    return;
  }
  const current = loadRecentActionIds();
  const next = [actionId, ...current.filter((entry) => entry !== actionId)].slice(
    0,
    MAX_RECENT_ACTIONS,
  );
  window.localStorage.setItem(RECENT_ACTION_IDS_STORAGE_KEY, JSON.stringify(next));
}

function clearRecentActionIds() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(RECENT_ACTION_IDS_STORAGE_KEY);
}
