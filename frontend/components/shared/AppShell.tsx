import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="page-shell min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_50%)]" />
      <div className="pointer-events-none absolute -right-16 top-24 h-56 w-56 rounded-full bg-fuchsia-500/16 blur-3xl" />
      <div className={cn("mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8", className)}>
        {children}
      </div>
    </div>
  );
}
