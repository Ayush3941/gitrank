import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExactTime } from "@/components/shared/ExactTime";

describe("ExactTime", () => {
  it("renders valid timestamps as semantic time elements", () => {
    render(<ExactTime value="2026-05-17T18:05:00.000Z" />);

    const time = screen.getByText(/May 17/).closest("time");
    expect(time?.getAttribute("datetime")).toBe("2026-05-17T18:05:00.000Z");
  });

  it("renders fallback text when the timestamp is unavailable", () => {
    render(<ExactTime value="not-a-date" fallback="time pending" />);

    expect(screen.getByText("time pending")).toBeTruthy();
    expect(document.querySelector("time")).toBeNull();
  });
});
