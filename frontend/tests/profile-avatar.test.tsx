import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileAvatar } from "@/components/shared/ProfileAvatar";

describe("ProfileAvatar", () => {
  it("labels the avatar wrapper and keeps the optimized image decorative", () => {
    const { container } = render(
      <ProfileAvatar src="https://example.com/avatar.png" displayName="Ayush Kumar Gaur" />,
    );

    expect(screen.getByRole("img", { name: "Ayush Kumar Gaur profile image" })).not.toBeNull();
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("uses stable intrinsic dimensions for the large avatar size", () => {
    const { container } = render(
      <ProfileAvatar src="https://example.com/avatar.png" displayName="Ayush Kumar Gaur" size="lg" />,
    );

    const image = container.querySelector("img");
    expect(image?.getAttribute("width")).toBe("96");
    expect(image?.getAttribute("height")).toBe("96");
  });

  it("falls back to a generic label when the display name is empty", () => {
    render(<ProfileAvatar src="https://example.com/avatar.png" displayName=" " />);

    expect(screen.getByRole("img", { name: "Profile image" })).not.toBeNull();
  });
});
