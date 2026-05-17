import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class TestIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {}

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: TestResizeObserver,
});

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: TestResizeObserver,
});

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: TestIntersectionObserver,
});

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: TestIntersectionObserver,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(URL, "createObjectURL", {
  writable: true,
  value: vi.fn(() => "blob:gitrank-export"),
});

Object.defineProperty(URL, "revokeObjectURL", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(HTMLAnchorElement.prototype, "click", {
  configurable: true,
  value: vi.fn(),
});
