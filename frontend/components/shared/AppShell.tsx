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
      <div className="pointer-events-none absolute inset-0 neon-vignette opacity-70" />
      <div className="pointer-events-none absolute inset-0 hidden md:block panel-grid opacity-[0.014] [mask-image:linear-gradient(180deg,black_8%,transparent_90%)]" />
      <div className="pointer-events-none absolute inset-x-[-6%] top-[-4rem] hidden h-[20rem] lg:block bg-[radial-gradient(ellipse_at_top,rgba(34,226,255,0.12)_0%,rgba(244,114,255,0.08)_34%,rgba(52,222,194,0.06)_56%,transparent_84%)]" />
      <div className={cn("mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8", className)}>
        {children}
      </div>
    </main>
  );
}
