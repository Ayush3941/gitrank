import {
  hasNonEmptyAttribute,
  readBooleanishAttribute,
  readElementName,
} from "./jsx-source-scan.mjs";

const decorativeChildTags = new Set(["Icon"]);

export function hasAccessibleNameAttribute(attributes) {
  return (
    hasNonEmptyAttribute(attributes, "aria-label")
    || hasNonEmptyAttribute(attributes, "aria-labelledby")
  );
}

export function hasReadableContent(children) {
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
    if (child?.type === "JSXElement" && hasReadableElement(child)) {
      return true;
    }
  }
  return false;
}

function hasReadableElement(element) {
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
  return hasReadableContent(element.children ?? []);
}
