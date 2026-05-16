import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AppShell className="flex min-h-[70vh] items-center justify-center">
      <GlowCard strong className="w-full max-w-2xl space-y-5 text-center">
        <p className="text-xs tracking-[0.24em] text-primary uppercase">404</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Route not found</h1>
        <p className="mx-auto max-w-xl text-sm text-slate-200/84 sm:text-base">
          This route does not exist in the current GitRank build.
          Use dashboard navigation or return to the main landing page.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </GlowCard>
    </AppShell>
  );
}
