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

    fireEvent.click(screen.getByRole("button", { name: "Clear contribution search" }));
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Search contributions" }), {
      key: "Escape",
    });

    expect(onClear).toHaveBeenCalledTimes(2);
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
