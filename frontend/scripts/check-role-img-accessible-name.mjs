import {
  hasNonEmptyAttribute,
  readStringAttribute,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (violations.length > 0) {
  console.error("Role=\"img\" accessible-name check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error("Elements with role=\"img\" must expose aria-label or aria-labelledby.");
  process.exit(1);
}

console.log("Role=\"img\" accessible-name check passed");

function checkElement({ openingElement, relativePath }) {
  const attributes = openingElement.attributes ?? [];
  const role = readStringAttribute(attributes, "role");
  if (role?.toLowerCase() !== "img") {
    return;
  }

  if (
    hasNonEmptyAttribute(attributes, "aria-label")
    || hasNonEmptyAttribute(attributes, "aria-labelledby")
  ) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} renders role="img" without an accessible name`);
}
