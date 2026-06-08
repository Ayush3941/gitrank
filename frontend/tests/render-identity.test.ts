import { describe, expect, it } from "vitest";
import { buildStableRenderRows } from "@/lib/presentation/render-identity";

describe("buildStableRenderRows", () => {
  it("uses preferred IDs when present", () => {
    const rows = buildStableRenderRows(
      [
        { id: "rank-chip", label: "Rank Gold" },
        { id: "sync-chip", label: "Rank Gold" },
      ],
      (item) => item.label,
      (item) => item.id,
    );

    expect(rows.map((row) => row.renderId)).toEqual(["rank-chip", "sync-chip"]);
  });

  it("normalizes seed IDs and suffixes repeated rows", () => {
    const rows = buildStableRenderRows(
      [
        { className: "h-24 w-full" },
        { className: "h-24 w-full" },
        { className: " h-10   w-2/5 " },
      ],
      (item) => item.className,
    );

    expect(rows.map((row) => row.renderId)).toEqual([
      "h-24-w-full",
      "h-24-w-full#2",
      "h-10-w-2/5",
    ]);
  });
});
