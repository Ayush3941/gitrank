import { afterEach, describe, expect, it, vi } from "vitest";
import { inferReducedGamificationPreference } from "@/hooks/use-gamification-preference";

type MutableNavigator = Navigator & {
  connection?: {
    saveData?: boolean;
  };
};

const originalMatchMedia = window.matchMedia;
const navigatorDescriptor = Object.getOwnPropertyDescriptor(window, "navigator");
const originalNavigator = window.navigator;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  if (navigatorDescriptor) {
    Object.defineProperty(window, "navigator", navigatorDescriptor);
  } else {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
});

describe("inferReducedGamificationPreference", () => {
  it("returns true when browser data-saver is enabled", () => {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        connection: { saveData: true },
      } satisfies MutableNavigator,
    });
    window.matchMedia = vi.fn(() => ({ matches: false } as MediaQueryList));

    expect(inferReducedGamificationPreference()).toBe(true);
  });

  it("returns true when reduced-motion or reduced-data media query is active", () => {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        connection: { saveData: false },
      } satisfies MutableNavigator,
    });
    window.matchMedia = vi.fn((query: string) => {
      const active =
        query === "(prefers-reduced-motion: reduce)" ||
        query === "(prefers-reduced-data: reduce)";
      return { matches: active } as MediaQueryList;
    });

    expect(inferReducedGamificationPreference()).toBe(true);
  });

  it("returns false when no reduced-data or reduced-motion preference is active", () => {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        connection: { saveData: false },
      } satisfies MutableNavigator,
    });
    window.matchMedia = vi.fn(() => ({ matches: false } as MediaQueryList));

    expect(inferReducedGamificationPreference()).toBe(false);
  });
});
