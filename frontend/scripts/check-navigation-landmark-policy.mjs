import {
  hasNonEmptyAttribute,
  readElementName,
  readStringAttribute,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (violations.length > 0) {
  console.error("Navigation landmark policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Every navigation landmark must have a stable accessible name via aria-label or aria-labelledby.",
  );
  process.exit(1);
}

console.log("Navigation landmark policy check passed");

function checkElement({ openingElement, relativePath }) {
  const tagName = readElementName(openingElement.name);
  const attributes = openingElement.attributes ?? [];
  const role = readStringAttribute(attributes, "role");
  const isNavigation = tagName === "nav" || role?.toLowerCase() === "navigation";
  if (!isNavigation) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  if (hasAccessibleName(attributes)) {
    return;
  }
  violations.push(`${relativePath}:${line} renders an unnamed navigation landmark`);
}

function hasAccessibleName(attributes) {
  return (
    hasNonEmptyAttribute(attributes, "aria-label")
    || hasNonEmptyAttribute(attributes, "aria-labelledby")
  );
}
