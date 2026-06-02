import {
  readBooleanishAttribute,
  readStringAttribute,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const liveRegionRoles = new Set(["alert", "status"]);
const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (violations.length > 0) {
  console.error("Live-region atomicity check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error('Elements with role="status" or role="alert" must set aria-atomic="true".');
  process.exit(1);
}

console.log("Live-region atomicity check passed");

function checkElement({ openingElement, relativePath }) {
  const role = readStringAttribute(openingElement.attributes ?? [], "role");
  if (!liveRegionRoles.has(role ?? "")) {
    return;
  }

  if (readBooleanishAttribute(openingElement.attributes ?? [], "aria-atomic") === true) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} renders role="${role}" without aria-atomic="true"`);
}
