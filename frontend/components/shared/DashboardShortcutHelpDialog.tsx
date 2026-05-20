"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type DashboardShortcutHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHORTCUT_SECTIONS: Array<{
  title: string;
  rows: Array<{ keys: string; action: string; note?: string }>;
}> = [
  {
    title: "Navigation and discovery",
    rows: [
      {
        keys: "Ctrl/Cmd + K",
        action: "Open quick actions palette",
        note: "Search routes, sync actions, and display controls.",
      },
      {
        keys: "?",
        action: "Open this keyboard help",
        note: "Works when focus is outside editable fields.",
      },
      {
        keys: "↑ / ↓",
        action: "Move through quick-action results",
      },
      {
        keys: "Home / End",
        action: "Jump to first or last quick-action result",
      },
      {
        keys: "Enter",
        action: "Run highlighted quick action",
      },
      {
        keys: "Esc",
        action: "Close open dialog or palette",
        note: "In quick actions: clears active search first, then closes on the next press.",
      },
    ],
  },
  {
    title: "Display controls",
    rows: [
      {
        keys: "Alt + Shift + T",
        action: "Cycle theme",
      },
      {
        keys: "Alt + Shift + L",
        action: "Toggle text size (default / large)",
      },
      {
        keys: "Alt + Shift + G",
        action: "Toggle visual effects (full / reduced)",
      },
    ],
  },
];

export function DashboardShortcutHelpDialog({
  open,
  onOpenChange,
}: DashboardShortcutHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,44rem)] p-4 sm:p-6">
        <div className="space-y-1">
          <DialogTitle className="text-xl text-white">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-sm text-muted">
            Quick-reference controls for dashboard speed and accessibility.
          </DialogDescription>
        </div>
        <div className="space-y-4">
          {SHORTCUT_SECTIONS.map((section) => (
            <section key={section.title} className="space-y-2">
              <p className="px-0.5 text-xs font-medium text-cyan-100">
                {section.title}
              </p>
              <ul className="space-y-2">
                {section.rows.map((row) => (
                  <li
                    key={`${section.title}:${row.keys}:${row.action}`}
                    className="list-none neon-tile grid gap-2 border px-3 py-2.5 sm:grid-cols-[11rem,1fr]"
                  >
                    <p className="text-sm text-white">
                      <kbd>{row.keys}</kbd>
                    </p>
                    <div>
                      <p className="text-sm text-slate-100">{row.action}</p>
                      {row.note ? <p className="mt-1 text-xs text-muted">{row.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
