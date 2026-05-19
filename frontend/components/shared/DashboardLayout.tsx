import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/shared/DashboardSidebar";
import { DashboardTopBarContainer } from "@/components/shared/DashboardTopBarContainer";
import { MobileNav } from "@/components/shared/MobileNav";
import { AppShell } from "@/components/shared/AppShell";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell className="xl:grid xl:grid-cols-[17rem,1fr] xl:gap-5">
      <DashboardSidebar />
      <div className="min-w-0">
        <DashboardTopBarContainer />
        <div className="pb-24 xl:pb-0">{children}</div>
      </div>
      <MobileNav />
    </AppShell>
  );
}
