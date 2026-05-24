import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { DashboardAutoSyncCoordinator } from "@/components/shared/DashboardAutoSyncCoordinator";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <DashboardAutoSyncCoordinator />
      <div className="dashboard-stable-scroll min-w-0 space-y-5">
        <section className="dashboard-chrome px-2.5 py-2 sm:px-3 sm:py-2.5">
          <DashboardRouteNav embedded />
        </section>
        {children}
      </div>
    </AppShell>
  );
}
