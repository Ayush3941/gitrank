import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContributionList } from "@/features/contributions/components/ContributionList";
import { buildContribution } from "@/tests/helpers/contribution-fixture";

describe("ContributionList", () => {
  it("exposes contribution signal meters with bounded progress semantics", () => {
    render(<ContributionList items={[buildContribution()]} />);

    const meter = screen.getByRole("progressbar", {
      name: "Semantic signal contribution signal",
    });

    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
    expect(meter.getAttribute("aria-valuenow")).toBe("63");
    expect(meter.getAttribute("aria-valuetext")).toBe("Rising signal, 63 of 100");
  });
});
