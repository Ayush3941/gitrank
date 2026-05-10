import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/shared/DashboardSidebar";
import { DashboardTopBar } from "@/components/shared/DashboardTopBar";
import { MobileNav } from "@/components/shared/MobileNav";
import { AppShell } from "@/components/shared/AppShell";
import { ayushProfile } from "@/lib/mock-data/gitrank";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell className="xl:grid xl:grid-cols-[18rem,1fr] xl:gap-6">
      <DashboardSidebar />
      <div className="min-w-0">
        <DashboardTopBar user={ayushProfile} />
        <div className="pb-24 xl:pb-0">{children}</div>
      </div>
      <MobileNav />
    </AppShell>
  );
}
