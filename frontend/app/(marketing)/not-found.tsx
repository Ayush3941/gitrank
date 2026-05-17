import Link from "next/link";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export default function MarketingRouteNotFound() {
  return (
    <GlowCard strong className="space-y-4">
      <p className="text-xs tracking-[0.24em] text-primary uppercase">Marketing route not found</p>
      <h1 className="text-3xl font-semibold text-white">This public route does not exist</h1>
      <p className="max-w-2xl text-sm text-slate-200/84">
        Use the primary onboarding path or open login directly to continue with GitHub OAuth.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/login">Open login</Link>
        </Button>
        <Button asChild>
          <Link href="/onboarding/connect-github">Start onboarding</Link>
        </Button>
      </div>
    </GlowCard>
  );
}
