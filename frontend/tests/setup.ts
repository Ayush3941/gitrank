import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

process.env.GITRANK_PUBLIC_BASE_URL ??= "http://localhost:3000";
process.env.GITRANK_API_BASE_URL ??= "http://localhost:8080";
process.env.GITRANK_AUTH_BASE_URL ??= "http://localhost:8081";
process.env.NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME ??= "gitrank_csrf";
process.env.NEXT_PUBLIC_GITRANK_SCORE_VERSION_FALLBACK ??= "v1alpha1";

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

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

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
