import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="min-w-0 space-y-5">
        <DashboardRouteNav />
        {children}
      </div>
    </AppShell>
  );
}
