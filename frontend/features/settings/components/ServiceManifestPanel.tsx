"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceManifestProbes } from "@/hooks/use-service-manifest-probes";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

export function ServiceManifestPanel() {
  const { data, isLoading, isError, isFetching, error, refetch } = useServiceManifestProbes();
  const probes = data?.services ?? [];
  const errorMessage = sanitizeUserFacingError(
    (error as Error | null)?.message ?? "",
    "settings-service-manifests",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">Service manifest probes</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Cross-service backend coverage</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Pulls live `/v1/meta/manifest` data from each backend service so route coverage can be audited in frontend.
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
        <p className="text-sm text-muted">Loading service manifests...</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-rose-200">
          {errorMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {probes.map((probe) => {
            const routeCount = probe.manifest?.routes?.length ?? 0;
            const dependencyCount = probe.manifest?.dependencies?.length ?? 0;
            return (
              <li
                key={probe.key}
                className="neon-surface flex flex-wrap items-start justify-between gap-3 rounded-[0.8rem] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{probe.name}</p>
                  <p className="break-anywhere text-xs text-muted">{probe.base_url}</p>
                  <p className="text-xs text-muted">
                    {routeCount} routes
                    {dependencyCount > 0 ? ` · ${dependencyCount} dependencies` : ""}
                    {probe.manifest?.version ? ` · ${probe.manifest.version}` : ""}
                  </p>
                  {probe.error ? (
                    <p className="mt-1 text-xs text-rose-200">{probe.error}</p>
                  ) : null}
                </div>
                <span
                  className={
                    probe.status === "ok"
                      ? "rounded-full border border-emerald-300/30 bg-emerald-300/14 px-2 py-0.5 text-xs text-emerald-100"
                      : "rounded-full border border-rose-300/30 bg-rose-500/12 px-2 py-0.5 text-xs text-rose-100"
                  }
                >
                  {probe.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
