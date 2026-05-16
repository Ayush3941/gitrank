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
      <div className="pointer-events-none absolute inset-0 neon-vignette" />
      <div className="pointer-events-none absolute inset-0 panel-grid opacity-[0.08] [mask-image:linear-gradient(180deg,black_4%,transparent_82%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(180deg,rgba(255,255,255,0.04)_0px,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_6px)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,rgba(34,226,255,0.28),transparent_52%)]" />
      <div className="pointer-events-none absolute inset-x-[-16%] top-[-4rem] h-40 rotate-[-4deg] bg-[linear-gradient(90deg,transparent,rgba(34,226,255,0.18),rgba(244,114,255,0.16),transparent)] blur-2xl" />
      <div className="pointer-events-none absolute -right-16 top-24 h-56 w-56 rounded-full bg-fuchsia-500/24 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-52 h-64 w-64 rounded-full bg-emerald-300/16 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-6 h-40 w-40 rounded-full bg-cyan-400/12 blur-3xl" />
      <div className={cn("mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8", className)}>
        {children}
      </div>
    </div>
  );
}
