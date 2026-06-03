import {
  hasAccessibleNameAttribute,
  hasReadableContent,
} from "./lib/jsx-accessible-content.mjs";
import {
  readElementName,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const checkedTags = new Set(["a", "Link", "IntentPrefetchLink"]);
const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (violations.length > 0) {
  console.error("Link accessible-name check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Links must expose a readable accessible name through visible text, aria-label, aria-labelledby, or an sr-only label.",
  );
  process.exit(1);
}

console.log("Link accessible-name check passed");

function checkElement({ element, openingElement, relativePath }) {
  const tagName = readElementName(openingElement.name);
  if (!checkedTags.has(tagName)) {
    return;
  }

  const attributes = openingElement.attributes ?? [];
  if (hasAccessibleNameAttribute(attributes) || hasReadableContent(element.children ?? [])) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} renders <${tagName}> without an accessible name`);
}
