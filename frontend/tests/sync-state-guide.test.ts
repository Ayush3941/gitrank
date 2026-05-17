import { describe, expect, it } from "vitest";
import { syncStateGuideCopy } from "@/components/shared/SyncStateGuide";

describe("syncStateGuideCopy", () => {
  it("returns an account-recovery CTA for failed sync state", () => {
    const copy = syncStateGuideCopy("failed");
    expect(copy.title).toContain("Sync failed");
    expect(copy.actionHref).toBe("/dashboard/settings");
  });

  it("returns contribution-lane CTA for syncing state", () => {
    const copy = syncStateGuideCopy("syncing");
    expect(copy.actionHref).toBe("/dashboard/contributions");
    expect(copy.actionLabel).toContain("contribution");
  });
});
