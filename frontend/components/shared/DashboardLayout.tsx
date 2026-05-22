import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { DashboardTopBarContainer } from "@/components/shared/DashboardTopBarContainer";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="min-w-0 space-y-5">
        <section className="dashboard-chrome space-y-2 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <DashboardTopBarContainer embedded />
          <DashboardRouteNav embedded />
        </section>
        {children}
      </div>
    </AppShell>
  );
}
