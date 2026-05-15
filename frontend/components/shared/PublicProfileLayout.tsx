import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";

export function PublicProfileLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell className="max-w-6xl">
      <div className="space-y-6">
        <Link href="/" className="cyber-link text-sm font-medium">
          Back to GitRank
        </Link>
        {children}
      </div>
    </AppShell>
  );
}
