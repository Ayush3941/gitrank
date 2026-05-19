import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inferNetworkConstraintReason,
  inferReducedGamificationPreference,
} from "@/hooks/use-gamification-preference";

type MutableNavigator = Navigator & {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
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

describe("inferNetworkConstraintReason", () => {
  it("returns low-device-memory when RAM hint is small", () => {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        connection: { saveData: false, effectiveType: "4g" },
        deviceMemory: 2,
        hardwareConcurrency: 8,
      } satisfies MutableNavigator,
    });
    window.matchMedia = vi.fn(() => ({ matches: false } as MediaQueryList));

    expect(inferNetworkConstraintReason()).toBe("low-device-memory");
  });

  it("returns low-cpu-cores when hardwareConcurrency is constrained", () => {
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        connection: { saveData: false, effectiveType: "4g" },
        deviceMemory: 8,
        hardwareConcurrency: 2,
      } satisfies MutableNavigator,
    });
    window.matchMedia = vi.fn(() => ({ matches: false } as MediaQueryList));

    expect(inferNetworkConstraintReason()).toBe("low-cpu-cores");
  });
});
