import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";

describe("DeferUntilVisible", () => {
  it("renders deferred content when its lane enters the viewport", async () => {
    render(
      <DeferUntilVisible fallback={<p>Loading lane</p>}>
        <p>Deferred lane</p>
      </DeferUntilVisible>,
    );

    expect(await screen.findByText("Deferred lane")).toBeTruthy();
  });
});
