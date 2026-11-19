import { ShieldAlert } from "lucide-react";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export function GitHubAppSyncBlockNotice({
  message = "GitHub App installation is required for PR sync.",
  showSettingsLink = true,
}: {
  message?: string;
  showSettingsLink?: boolean;
}) {
  return (
    <GlowCard className="space-y-4 border-amber-300/28 bg-amber-400/12">
      <div className="flex items-start gap-3">
        <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/16 p-2 text-amber-100">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-100">PR sync is blocked</p>
          <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-amber-100">
            {message}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="default">
          <IntentPrefetchLink href="/oauth/github/install">Install GitHub App</IntentPrefetchLink>
        </Button>
        {showSettingsLink ? (
          <Button asChild size="sm" variant="secondary">
            <IntentPrefetchLink href="/dashboard/settings">Open sync settings</IntentPrefetchLink>
          </Button>
        ) : null}
      </div>
    </GlowCard>
  );
}
