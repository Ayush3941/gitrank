import type { ReactNode } from "react";
import { MarketingLayout } from "@/components/shared/MarketingLayout";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <MarketingLayout>{children}</MarketingLayout>;
}
