import { describe, expect, it } from "vitest";
import {
  appSyncFailureMessage,
  deriveAppSyncFailureCodeFromApiError,
  deriveAppSyncFailureCodeFromLastError,
  deriveAppSyncFailureCodeFromMetrics,
  type AppSyncFailureCode,
} from "@/lib/sync/app-sync-failure";

describe("app-sync-failure policy", () => {
  it("maps strict app failure codes from backend last_error text", () => {
    const cases: Array<{ code: AppSyncFailureCode; lastError: string }> = [
      {
        code: "app_installation_required",
        lastError: "github-ingestor user sync failed [github_app_installation_required]: install app first",
      },
      {
        code: "app_installation_unavailable",
        lastError: "github-ingestor user sync failed [github_app_installation_unavailable]: token mint failed",
      },
      {
        code: "app_runtime_required",
        lastError: "strict github app sync runtime is required before extracting github contribution data",
      },
      {
        code: "sync_config_unavailable",
        lastError: "github-ingestor user sync failed [sync_config_unavailable]: github app config missing",
      },
      {
        code: "user_sync_actor_mismatch",
        lastError: "requested user must match authenticated github login for user sync",
      },
    ];

    for (const testCase of cases) {
      expect(
        deriveAppSyncFailureCodeFromLastError(testCase.lastError.toLowerCase()),
      ).toBe(testCase.code);
    }
  });

  it("maps strict app failure codes from metrics", () => {
    expect(
      deriveAppSyncFailureCodeFromMetrics({ app_installation_required: 1 }),
    ).toBe("app_installation_required");
    expect(
      deriveAppSyncFailureCodeFromMetrics({ app_installation_unavailable: 1 }),
    ).toBe("app_installation_unavailable");
    expect(
      deriveAppSyncFailureCodeFromMetrics({ strict_app_runtime_required: 1 }),
    ).toBe("app_runtime_required");
    expect(
      deriveAppSyncFailureCodeFromMetrics({ sync_config_unavailable: 1 }),
    ).toBe("sync_config_unavailable");
    expect(
      deriveAppSyncFailureCodeFromMetrics({ user_sync_actor_mismatch: 1 }),
    ).toBe("user_sync_actor_mismatch");
  });

  it("maps strict app failure codes from API error payloads", () => {
    expect(
      deriveAppSyncFailureCodeFromApiError(
        "github app installation is required for user sync; install app and retry",
        "github_app_installation_required",
      ),
    ).toBe("app_installation_required");
    expect(
      deriveAppSyncFailureCodeFromApiError(
        "github app installation token unavailable for user sync",
        "github_app_installation_unavailable",
      ),
    ).toBe("app_installation_unavailable");
    expect(
      deriveAppSyncFailureCodeFromApiError(
        "strict github app sync runtime is required",
        "github_app_runtime_required",
      ),
    ).toBe("app_runtime_required");
    expect(
      deriveAppSyncFailureCodeFromApiError(
        "GitHub App sync configuration is incomplete.",
        "sync_config_unavailable",
      ),
    ).toBe("sync_config_unavailable");
    expect(
      deriveAppSyncFailureCodeFromApiError(
        "requested user must match authenticated github login for user sync",
        "user_sync_actor_mismatch",
      ),
    ).toBe("user_sync_actor_mismatch");
  });

  it("returns stable remediation copy for all strict app failure codes", () => {
    expect(appSyncFailureMessage("app_installation_required")).toContain("installation is required");
    expect(appSyncFailureMessage("app_installation_unavailable")).toContain("token is unavailable");
    expect(appSyncFailureMessage("app_runtime_required")).toContain("non-App extraction path");
    expect(appSyncFailureMessage("sync_config_unavailable")).toContain("GITHUB_APP_*");
    expect(appSyncFailureMessage("user_sync_actor_mismatch")).toContain("does not match");
  });
});
