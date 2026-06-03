import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchInputWithClear } from "@/components/shared/SearchInputWithClear";

describe("SearchInputWithClear", () => {
  it("clears via button and escape key when input has content", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <SearchInputWithClear
        value="fabric"
        onChange={onChange}
        onClear={onClear}
        placeholder="Search..."
        ariaLabel="Search contributions"
        clearButtonLabel="Clear contribution search"
      />,
    );

    const clear = screen.getByRole("button", { name: "Clear contribution search" });
    expect(clear.className).toContain("h-10 w-10");
    expect(clear.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(clear);
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Search contributions" }), {
      key: "Escape",
    });

    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it("marks the leading search icon as decorative", () => {
    const { container } = render(
      <SearchInputWithClear
        value=""
        onChange={() => undefined}
        onClear={() => undefined}
        placeholder="Search..."
        ariaLabel="Search repositories"
        clearButtonLabel="Clear repository search"
      />,
    );

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("uses aria-label instead of placeholder text as the accessible name", () => {
    render(
      <SearchInputWithClear
        value=""
        onChange={() => undefined}
        onClear={() => undefined}
        placeholder="Search repository or reason"
        ariaLabel="Search repositories"
        clearButtonLabel="Clear repository search"
      />,
    );

    const input = screen.getByRole("searchbox", { name: "Search repositories" });
    expect(input.getAttribute("placeholder")).toBe("Search repository or reason");
    expect(input.className).toContain("rounded-[var(--radius-universal)]");
    expect(screen.queryByRole("searchbox", { name: "Search repository or reason" })).toBeNull();
  });

  it("does not render clear button when input is empty", () => {
    render(
      <SearchInputWithClear
        value=""
        onChange={() => undefined}
        onClear={() => undefined}
        placeholder="Search..."
        ariaLabel="Search repositories"
        clearButtonLabel="Clear repository search"
      />,
    );

    expect(screen.queryByRole("button", { name: "Clear repository search" })).toBeNull();
  });

  it("returns focus to the search input after clear button click", async () => {
    function Harness() {
      const [value, setValue] = useState("fabric");
      return (
        <SearchInputWithClear
          value={value}
          onChange={setValue}
          onClear={() => setValue("")}
          placeholder="Search..."
          ariaLabel="Search sync runs"
          clearButtonLabel="Clear sync run search"
        />
      );
    }

    render(<Harness />);

    const input = screen.getByRole("searchbox", { name: "Search sync runs" });
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("button", { name: "Clear sync run search" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
    expect((input as HTMLInputElement).value).toBe("");
  });
});
