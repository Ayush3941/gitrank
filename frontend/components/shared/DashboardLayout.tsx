import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { DashboardAutoSyncCoordinator } from "@/components/shared/DashboardAutoSyncCoordinator";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <DashboardAutoSyncCoordinator />
      <div className="min-w-0 space-y-4">
        <DashboardRouteNav />
        {children}
      </div>
    </AppShell>
  );
}
