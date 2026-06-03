import {
  hasNonEmptyAttribute,
  readElementName,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (violations.length > 0) {
  console.error("Progress accessible-name check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error("Shared <Progress> meters must expose aria-label or aria-labelledby.");
  process.exit(1);
}

console.log("Progress accessible-name check passed");

function checkElement({ openingElement, relativePath }) {
  const tagName = readElementName(openingElement.name);
  if (tagName !== "Progress") {
    return;
  }

  const attributes = openingElement.attributes ?? [];
  if (
    hasNonEmptyAttribute(attributes, "aria-label")
    || hasNonEmptyAttribute(attributes, "aria-labelledby")
  ) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} renders <Progress> without an accessible name`);
}
