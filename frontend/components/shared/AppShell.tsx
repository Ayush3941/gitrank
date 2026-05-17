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
      <div className="pointer-events-none absolute inset-0 neon-vignette" />
      <div className="pointer-events-none absolute inset-0 hidden md:block panel-grid opacity-[0.035] [mask-image:linear-gradient(180deg,black_6%,transparent_84%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 md:h-[28rem] bg-[radial-gradient(ellipse_at_top,rgba(34,226,255,0.22)_0%,rgba(244,114,255,0.14)_36%,transparent_74%)]" />
      <div className="pointer-events-none absolute inset-x-[-14%] top-[-6rem] hidden h-56 bg-[radial-gradient(ellipse_at_center,rgba(34,226,255,0.22)_0%,rgba(244,114,255,0.14)_42%,transparent_72%)] blur-3xl lg:block" />
      <div className={cn("mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8", className)}>
        {children}
      </div>
    </main>
  );
}
