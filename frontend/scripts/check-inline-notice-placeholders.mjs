#!/usr/bin/env node
import {
  hasNonEmptyAttribute,
  readElementName,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (violations.length > 0) {
  console.error("InlineNotice placeholder policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error("InlineNotice needs contextual placeholder text so empty notice lanes do not fall back to generic status copy.");
  process.exit(1);
}

console.log("InlineNotice placeholder policy check passed");

function checkElement({ openingElement, relativePath }) {
  if (readElementName(openingElement.name) !== "InlineNotice") {
    return;
  }

  if (hasNonEmptyAttribute(openingElement.attributes ?? [], "placeholder")) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} renders InlineNotice without a contextual placeholder`);
}
