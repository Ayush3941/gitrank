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
  GitPullRequest,
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
import { filterQuickActions, type QuickActionItem } from "@/lib/quick-actions";

const THEME_ORDER: ThemePreference[] = ["neon", "midnight", "aurora", "high-contrast"];

type ActionTone = "default" | "success" | "info";

type DashboardQuickActionsProps = {
  username: string;
  onRunSyncNow?: () => void;
  syncPending?: boolean;
};

export function DashboardQuickActions({
  username,
  onRunSyncNow,
  syncPending = false,
}: DashboardQuickActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { enabled: displayShortcutsEnabled } = useDisplayShortcutsEnabled();
  const { theme, setTheme } = useThemePreference();
  const { textScale, setTextScale } = useTextScalePreference();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);
  const shortcutHint = "Ctrl/Cmd+K";

  const actions = useMemo<QuickActionItem[]>(() => {
    const routeActions = dashboardNavItems.map((item) => ({
      id: `goto:${item.href}`,
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
      label: "Open public profile",
      description: `View /u/${username} share card`,
      keywords: ["profile", "public", "share", username],
      icon: Sparkles,
      execute: () => {
        router.push(`/u/${encodeURIComponent(username)}`);
      },
    };

    const syncAction: QuickActionItem = {
      id: "sync:now",
      label: syncPending ? "Sync already running" : "Run GitHub sync now",
      description: syncPending
        ? "Background sync is already in progress"
        : "Trigger immediate evidence refresh for dashboard lanes",
      keywords: ["sync", "refresh", "github", "evidence"],
      icon: GitPullRequest,
      execute: () => {
        if (syncPending) {
          return;
        }
        onRunSyncNow?.();
      },
    };

    const themeAction: QuickActionItem = {
      id: "theme:cycle",
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
      label: textScale === "large" ? "Use default text size" : "Use large text size",
      description: "Toggle readability scaling for dense dashboard surfaces",
      keywords: ["text", "size", "readability", "large", "default"],
      icon: Search,
      shortcut: "Alt+Shift+L",
      execute: () => {
        setTextScale(textScale === "large" ? "default" : "large");
      },
    };

    return [...routeActions, profileAction, syncAction, themeAction, textAction];
  }, [onRunSyncNow, pathname, router, setTextScale, setTheme, syncPending, textScale, theme, username]);

  const filteredActions = useMemo(
    () => filterQuickActions(actions, deferredQuery),
    [actions, deferredQuery],
  );
  const topAction = filteredActions[0];

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

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
      setOpen((current) => !current);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [displayShortcutsEnabled]);

  function executeAction(action: QuickActionItem) {
    action.execute();
    setOpen(false);
    setQuery("");
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !topAction) {
      return;
    }
    event.preventDefault();
    executeAction(topAction);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
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
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Type an action, route, or keyword..."
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-300 focus:outline-none"
              aria-label="Search quick actions"
            />
            <span className="text-[11px] tracking-[0.12em] text-cyan-200 uppercase">{shortcutHint}</span>
          </div>
          <ul role="list" className="max-h-[50vh] space-y-2 overflow-auto pr-1">
            {filteredActions.length > 0 ? (
              filteredActions.map((action, index) => {
                const Icon = action.icon;
                const tone = actionTone(action.id, syncPending);
                return (
                  <li key={action.id}>
                    <button
                      type="button"
                      onClick={() => {
                        executeAction(action);
                      }}
                      className={cn(
                        "focus-ring neon-tile w-full border px-3 py-2.5 text-left transition",
                        tone === "success" && "border-emerald-300/30 text-emerald-100",
                        tone === "info" && "border-cyan-300/32 text-cyan-100",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                          {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
                          {index === 0 ? "↵ " : ""}
                          {action.label}
                        </span>
                        {action.shortcut ? (
                          <kbd className="text-[11px]">{action.shortcut}</kbd>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-200">{action.description}</p>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="neon-tile rounded-[0.1rem] border border-dashed border-primary/30 px-3 py-3 text-sm text-slate-200">
                No matching action. Try route names like <span className="text-white">contributions</span> or <span className="text-white">settings</span>.
              </li>
            )}
          </ul>
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

function actionTone(actionId: string, syncPending: boolean): ActionTone {
  if (actionId === "sync:now") {
    return syncPending ? "info" : "success";
  }
  return "default";
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
