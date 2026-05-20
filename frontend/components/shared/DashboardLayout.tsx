import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="min-w-0">{children}</div>
    </AppShell>
  );
}
