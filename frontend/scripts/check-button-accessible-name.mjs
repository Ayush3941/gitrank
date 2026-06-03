import {
  hasAttribute,
  hasNonEmptyAttribute,
  readBooleanishAttribute,
  readElementName,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const checkedTags = new Set(["button", "Button"]);
const decorativeChildTags = new Set(["Icon"]);
const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (violations.length > 0) {
  console.error("Button accessible-name check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Buttons must expose a readable accessible name through visible text, aria-label, aria-labelledby, or an sr-only label.",
  );
  process.exit(1);
}

console.log("Button accessible-name check passed");

function checkElement({ element, openingElement, relativePath }) {
  const tagName = readElementName(openingElement.name);
  if (!checkedTags.has(tagName)) {
    return;
  }

  const attributes = openingElement.attributes ?? [];
  if (tagName === "Button" && hasAttribute(attributes, "asChild")) {
    return;
  }
  if (hasAccessibleNameAttribute(attributes) || hasNameFromChildren(element.children ?? [])) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} renders <${tagName}> without an accessible name`);
}

function hasAccessibleNameAttribute(attributes) {
  return (
    hasNonEmptyAttribute(attributes, "aria-label")
    || hasNonEmptyAttribute(attributes, "aria-labelledby")
  );
}

function hasNameFromChildren(children) {
  for (const child of children) {
    if (child?.type === "JSXText" && child.value.trim()) {
      return true;
    }
    if (
      child?.type === "JSXExpressionContainer"
      && child.expression?.type !== "JSXEmptyExpression"
    ) {
      return true;
    }
    if (child?.type === "JSXElement" && hasNameFromElement(child)) {
      return true;
    }
  }
  return false;
}

function hasNameFromElement(element) {
  const opening = element.openingElement;
  const tagName = readElementName(opening.name);
  const attributes = opening.attributes ?? [];
  if (readBooleanishAttribute(attributes, "aria-hidden") === true) {
    return false;
  }
  if (hasAccessibleNameAttribute(attributes)) {
    return true;
  }
  if (decorativeChildTags.has(tagName) || tagName.endsWith("Icon")) {
    return false;
  }
  return hasNameFromChildren(element.children ?? []);
}
