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
      <div className="pointer-events-none absolute inset-0 hidden md:block panel-grid opacity-[0.026] [mask-image:linear-gradient(180deg,black_8%,transparent_90%)]" />
      <div className="pointer-events-none absolute inset-x-[-10%] top-[-6rem] h-[24rem] md:h-[30rem] bg-[radial-gradient(ellipse_at_top,rgba(34,226,255,0.2)_0%,rgba(244,114,255,0.14)_32%,rgba(52,222,194,0.1)_54%,transparent_82%)]" />
      <div className={cn("mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8", className)}>
        {children}
      </div>
    </main>
  );
}
