import Link from "next/link";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <GlowCard strong className="space-y-4">
      <p className="text-xs tracking-[0.24em] text-primary uppercase">Dashboard route missing</p>
      <h1 className="text-3xl font-semibold text-white">This dashboard page does not exist</h1>
      <p className="max-w-2xl text-sm text-slate-200/84">
        The requested dashboard route is unavailable in this build.
        Use the core dashboard routes below.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard/contributions">Contributions</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard/settings">Settings</Link>
        </Button>
      </div>
    </GlowCard>
  );
}
