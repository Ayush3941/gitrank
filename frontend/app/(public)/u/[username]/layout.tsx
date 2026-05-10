import type { ReactNode } from "react";
import { PublicProfileLayout } from "@/components/shared/PublicProfileLayout";

export default function UserProfileRouteLayout({ children }: { children: ReactNode }) {
  return <PublicProfileLayout>{children}</PublicProfileLayout>;
}
