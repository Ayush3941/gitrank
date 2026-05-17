import { describe, expect, it } from "vitest";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

describe("sanitizeUserFacingError", () => {
  it("maps timeout-heavy upstream errors to concise copy", () => {
    const message =
      "Get \"https://api.github.com/repos/llvm/llvm-project/pulls/182707/reviews?per_page=20\": context deadline exceeded (Client.Timeout exceeded while awaiting headers)";
    expect(sanitizeUserFacingError(message, "onboarding-sync")).toBe(
      "GitHub did not respond in time. Wait about a minute, then retry.",
    );
  });

  it("maps missing csrf token errors to a session recovery message", () => {
    expect(
      sanitizeUserFacingError("CSRF cookie is missing.", "settings-account-actions"),
    ).toBe("Session protection expired. Refresh the page and sign in again before retrying.");
  });

  it("uses context fallback for generic 500-class technical errors", () => {
    expect(
      sanitizeUserFacingError("User sync failed. Status 500.", "onboarding-sync"),
    ).toBe(
      "Sync failed for now. Keep this page open and retry shortly while background refresh continues.",
    );
  });

  it("keeps already clear user-facing errors unchanged", () => {
    const message =
      "GitHub rate limits are active right now. Wait briefly, then retry.";
    expect(sanitizeUserFacingError(message, "settings-privacy")).toBe(message);
  });
});
