import { describe, expect, it } from "vitest";
import { shouldShowReactQueryDevtools } from "@/components/providers/query-provider";

describe("shouldShowReactQueryDevtools", () => {
  it("shows devtools on local hosts outside production", () => {
    expect(shouldShowReactQueryDevtools({
      hostname: "localhost",
      nodeEnv: "development",
    })).toBe(true);
    expect(shouldShowReactQueryDevtools({
      hostname: "app.local",
      nodeEnv: "test",
    })).toBe(true);
  });

  it("keeps devtools disabled for production and remote hosts", () => {
    expect(shouldShowReactQueryDevtools({
      hostname: "localhost",
      nodeEnv: "production",
    })).toBe(false);
    expect(shouldShowReactQueryDevtools({
      hostname: "gitrank.example.com",
      nodeEnv: "development",
    })).toBe(false);
  });
});
