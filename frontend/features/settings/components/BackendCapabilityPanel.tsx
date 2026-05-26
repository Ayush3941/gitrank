"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceDependencies, useServiceManifest } from "@/hooks/use-service-manifest";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

export function BackendCapabilityPanel() {
  const manifestQuery = useServiceManifest();
  const dependenciesQuery = useServiceDependencies();
  const { data, isLoading, isError, isFetching, error } = manifestQuery;
  const routes = data?.routes ?? [];
  const dependencies = dependenciesQuery.data ?? data?.dependencies ?? [];
  const implementedRouteCount = routes.filter((route) => route.status === "implemented").length;

  const errorMessage = sanitizeUserFacingError(
    (error as Error | null)?.message ?? "",
    "settings-backend-capabilities",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">Backend capability map</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Gateway route coverage</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Pulled live from backend service manifest to keep frontend surface aligned with real API capabilities.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isFetching}
          onClick={() => {
            void manifestQuery.refetch();
            void dependenciesQuery.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          {isFetching || dependenciesQuery.isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading backend capabilities...</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-rose-200">
          {errorMessage}
        </p>
      ) : dependenciesQuery.isError ? (
        <p role="alert" className="text-sm text-rose-200">
          {sanitizeUserFacingError(
            (dependenciesQuery.error as Error | null)?.message ?? "",
            "settings-backend-capabilities",
          )}
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="neon-surface rounded-[0.8rem] px-3 py-2">
              <p className="text-xs text-muted">Service</p>
              <p className="text-sm font-semibold text-white">{data?.service ?? "unknown"}</p>
            </div>
            <div className="neon-surface rounded-[0.8rem] px-3 py-2">
              <p className="text-xs text-muted">Version</p>
              <p className="text-sm font-semibold text-white">{data?.version ?? "unknown"}</p>
            </div>
            <div className="neon-surface rounded-[0.8rem] px-3 py-2">
              <p className="text-xs text-muted">Implemented routes</p>
              <p className="text-sm font-semibold text-white">
                {implementedRouteCount}/{routes.length}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Exposed routes</p>
            <ul className="space-y-2">
              {routes.slice(0, 14).map((route) => (
                <li
                  key={`${route.method}:${route.path}`}
                  className="neon-surface flex flex-wrap items-start justify-between gap-3 rounded-[0.8rem] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {route.method} <span className="text-primary">{route.path}</span>
                    </p>
                    <p className="text-xs text-muted">{route.summary}</p>
                  </div>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/14 px-2 py-0.5 text-xs text-emerald-100">
                    {route.status}
                  </span>
                </li>
              ))}
            </ul>
            {routes.length > 14 ? (
              <p className="text-xs text-muted">Showing 14/{routes.length} routes to keep this panel compact.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Dependencies</p>
            <ul className="space-y-2">
              {dependencies.map((dependency) => (
                <li
                  key={`${dependency.kind}:${dependency.name}:${dependency.base_url ?? "none"}`}
                  className="neon-surface flex flex-wrap items-start justify-between gap-3 rounded-[0.8rem] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{dependency.name}</p>
                    <p className="text-xs text-muted">{dependency.purpose}</p>
                    <p className="text-xs text-muted">
                      {dependency.kind}
                      {dependency.auth ? ` · auth ${dependency.auth}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-300/14 px-2 py-0.5 text-xs text-cyan-100">
                    {dependency.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
