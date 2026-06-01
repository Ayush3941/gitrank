import { ShieldAlert } from "lucide-react";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export function GitHubAppSyncBlockNotice({
  message = "GitHub App installation is required for PR sync.",
}: {
  message?: string;
}) {
  return (
    <GlowCard role="alert" className="space-y-3 border-amber-300/28 bg-amber-400/12">
      <div className="flex items-start gap-3">
        <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/16 p-2 text-amber-100">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-100">PR sync is blocked</p>
          <p className="text-sm text-amber-100">{message}</p>
          <p className="text-xs text-amber-100/90">
            GitRank extracts PR evidence only through GitHub App installation tokens.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="ghost">
          <IntentPrefetchLink href="/oauth/github/install">Install GitHub App</IntentPrefetchLink>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <IntentPrefetchLink href="/dashboard/settings">Open sync settings</IntentPrefetchLink>
        </Button>
      </div>
    </GlowCard>
  );
}
