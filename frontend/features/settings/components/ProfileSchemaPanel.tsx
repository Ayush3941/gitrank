"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfileSchema } from "@/hooks/use-profile-schema";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

export function ProfileSchemaPanel() {
  const { data, isLoading, isError, isFetching, error, refetch } = useProfileSchema();
  const sections = data ?? [];
  const errorMessage = sanitizeUserFacingError(
    (error as Error | null)?.message ?? "",
    "settings-profile-schema",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">Profile schema</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Backend profile sections</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Live section schema from profile-service via api-gateway. This guards dashboard/profile parity against backend
            section changes.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isFetching}
          onClick={() => {
            void refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading profile schema...</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-rose-200">
          {errorMessage}
        </p>
      ) : sections.length === 0 ? (
        <p className="text-sm text-muted">No profile schema sections returned by backend.</p>
      ) : (
        <ul className="space-y-2">
          {sections.map((section) => (
            <li
              key={`${section.key}:${section.status}`}
              className="neon-surface flex flex-wrap items-start justify-between gap-3 rounded-[0.8rem] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{section.key}</p>
                <p className="text-xs text-muted">{section.summary}</p>
              </div>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/14 px-2 py-0.5 text-xs text-emerald-100">
                {section.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
