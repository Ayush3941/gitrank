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
    <main id="main-content" className="page-shell min-h-screen" tabIndex={-1}>
      <div className="pointer-events-none absolute inset-0 neon-vignette opacity-45" />
      <div className={cn("mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8", className)}>
        {children}
      </div>
    </main>
  );
}
