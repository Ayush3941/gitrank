import Link from "next/link";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export default function PublicProfileNotFound() {
  return (
    <GlowCard strong className="space-y-4">
      <p className="text-xs tracking-[0.24em] text-primary uppercase">Public profile not found</p>
      <h1 className="text-3xl font-semibold text-white">This contributor profile is unavailable</h1>
      <p className="max-w-2xl text-sm text-slate-200/84">
        The requested profile path does not exist in the current GitRank snapshot.
        Try the dashboard profile view or return to the main landing route.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard/contributions">Browse contributions</Link>
        </Button>
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </GlowCard>
  );
}
