import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/shared/DashboardLayout";

export default function DashboardRouteLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
