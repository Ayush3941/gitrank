"use client";

import { AppShell } from "@/components/shared/AppShell";
import { RouteErrorCard } from "@/components/shared/RouteErrorCard";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-full text-foreground">
        <AppShell className="flex min-h-[70vh] items-center justify-center">
          <RouteErrorCard
            centered
            eyebrow="Global route error"
            title="Something went wrong"
            description="GitRank hit an unexpected failure while rendering this route. Retry this view or return to a stable dashboard path."
            retryLabel="Retry view"
            actions={[{ label: "Open dashboard", href: "/dashboard", variant: "default" }]}
            analyticsTarget="global:route-error"
            errorDigest={error.digest}
            reset={reset}
          />
        </AppShell>
      </body>
    </html>
  );
}
