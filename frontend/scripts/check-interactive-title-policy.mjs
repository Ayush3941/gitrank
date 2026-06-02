import {
  hasAttribute,
  readElementName,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const interactiveNames = new Set([
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "Button",
  "IntentPrefetchLink",
  "Link",
]);
const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (violations.length > 0) {
  console.error("Interactive title policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Interactive controls must use visible text, aria-label, aria-labelledby, or aria-describedby instead of browser title tooltips.",
  );
  process.exit(1);
}

console.log("Interactive title policy check passed");

function checkElement({ openingElement, relativePath }) {
  const tagName = readElementName(openingElement.name);
  if (!interactiveNames.has(tagName) || !hasAttribute(openingElement.attributes ?? [], "title")) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} renders interactive <${tagName}> with a title attribute`);
}
