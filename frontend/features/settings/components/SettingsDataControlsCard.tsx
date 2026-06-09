"use client";

import { Download, Trash2 } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export function SettingsDataControlsCard({
  isActing,
  isExportPending,
  isDeletePending,
  onExportAccountData,
  onDeleteAccount,
}: {
  isActing: boolean;
  isExportPending: boolean;
  isDeletePending: boolean;
  onExportAccountData: () => void;
  onDeleteAccount: () => void;
}) {
  return (
    <GlowCard className="space-y-4">
      <div>
        <p className="text-xs font-medium text-primary">Data controls</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Data export and deletion</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={isActing}
          aria-busy={isExportPending || undefined}
          onClick={onExportAccountData}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {isExportPending ? "Exporting data" : "Export data"}
        </Button>
      </div>
      <div className="space-y-2 rounded-[var(--radius-universal)] border border-rose-300/24 bg-rose-500/8 px-3 py-3">
        <p className="text-xs text-rose-100">
          Delete wipes synced PR history, score events, badges, profile state, and signs you out. Next login starts from a fresh account state.
        </p>
        <Button
          variant="danger"
          className="w-full justify-center"
          disabled={isActing}
          aria-busy={isDeletePending || undefined}
          onClick={onDeleteAccount}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {isDeletePending ? "Deleting account" : "Delete account"}
        </Button>
      </div>
    </GlowCard>
  );
}
