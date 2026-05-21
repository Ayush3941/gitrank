import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { DashboardTopBarContainer } from "@/components/shared/DashboardTopBarContainer";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="min-w-0 space-y-5">
        <section className="dashboard-chrome space-y-2.5 px-2.5 py-2.5 sm:px-3 sm:py-3">
          <DashboardTopBarContainer embedded />
          <div className="dashboard-chrome-divider" />
          <DashboardRouteNav embedded />
        </section>
        {children}
      </div>
    </AppShell>
  );
}
