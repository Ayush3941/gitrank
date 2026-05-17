import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonLdScript } from "@/components/shared/JsonLdScript";

describe("JsonLdScript", () => {
  it("escapes angle brackets in serialized JSON payloads", () => {
    const rendered = render(
      <JsonLdScript
        id="jsonld-test"
        data={{
          "@context": "https://schema.org",
          "@type": "Thing",
          name: "<unsafe>",
        }}
      />,
    );

    const script = rendered.container.querySelector("#jsonld-test");
    expect(script).toBeTruthy();
    const payload = script?.textContent ?? "";
    expect(payload.includes("\\u003cunsafe>")).toBe(true);
    expect(payload.includes("<unsafe>")).toBe(false);
  });
});
