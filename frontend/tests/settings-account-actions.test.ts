import { describe, expect, it } from "vitest";
import { buildAccountExportFilename } from "@/features/settings/lib/settings-account-export";
import type { AccountDataExport } from "@/lib/api/account-api";

describe("buildAccountExportFilename", () => {
  it("uses the preferred account handle and export date", () => {
    expect(
      buildAccountExportFilename(
        buildAccountExport({ generated_at: "2026-05-27T10:13:50.000Z" }),
        "Ayush3941",
      ),
    ).toBe("gitrank-account-export-Ayush3941-2026-05-27.json");
  });

  it("falls back to public handle and sanitizes unsafe filename characters", () => {
    expect(
      buildAccountExportFilename(
        buildAccountExport({
          generated_at: "2026-05-27T10:13:50.000Z",
          user: {
            public_handle: "octo/cat local",
            display_name: "Octo Cat",
          },
        }),
      ),
    ).toBe("gitrank-account-export-octo-cat-local-2026-05-27.json");
  });

  it("uses today's date when the export timestamp is invalid", () => {
    const today = new Date().toISOString().slice(0, 10);

    expect(
      buildAccountExportFilename(
        buildAccountExport({
          generated_at: "not-a-date",
          user: {
            public_handle: "",
            display_name: "Octo Cat",
          },
        }),
      ),
    ).toBe(`gitrank-account-export-account-${today}.json`);
  });
});

function buildAccountExport(overrides: Partial<AccountDataExport> = {}): AccountDataExport {
  return {
    export_version: "account-export/v1",
    generated_at: "2026-05-25T00:00:00.000Z",
    user: {
      public_handle: "octocat",
      display_name: "Octo Cat",
    },
    profile: {},
    ...overrides,
  };
}
