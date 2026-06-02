import {
  readElementName,
  scanJSXFiles,
} from "./jsx-source-scan.mjs";

export function runAccessibleNameCheck({
  checkLabel,
  tagNames,
  ignoredFiles = [],
  failureMessage,
  successMessage,
  root = process.cwd(),
  scanRoots,
}) {
  const tagNameSet = new Set(tagNames);
  const violations = [];

  violations.push(...scanJSXFiles({
    root,
    scanRoots,
    ignoredFiles,
    onElement: ({ element, relativePath }) => {
      checkElement(element, relativePath, {
        tagNameSet,
        violations,
      });
    },
  }));

  if (violations.length > 0) {
    console.error(`${checkLabel} accessible-name check failed:`);
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    console.error(failureMessage);
    process.exit(1);
  }

  console.log(successMessage);
}

function checkElement(element, relativePath, context) {
  const opening = element.openingElement;
  const tagName = readElementName(opening.name);
  if (!context.tagNameSet.has(tagName)) {
    return;
  }

  const attributes = opening.attributes ?? [];
  if (hasAccessibleNamePath(attributes)) {
    return;
  }
  const line = opening.loc?.start?.line ?? 1;
  context.violations.push(`${relativePath}:${line} renders <${tagName}> without an explicit accessible-name path`);
}

function hasAccessibleNamePath(attributes) {
  return (
    hasNonEmptyAttribute(attributes, "aria-label") ||
    hasNonEmptyAttribute(attributes, "aria-labelledby") ||
    hasNonEmptyAttribute(attributes, "title") ||
    hasNonEmptyAttribute(attributes, "id")
  );
}

function hasNonEmptyAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (
      attribute?.type !== "JSXAttribute" ||
      attribute.name?.type !== "JSXIdentifier" ||
      attribute.name.name !== name
    ) {
      continue;
    }
    if (!attribute.value) {
      return false;
    }
    if (attribute.value.type === "StringLiteral") {
      return attribute.value.value.trim().length > 0;
    }
    if (attribute.value.type === "JSXExpressionContainer") {
      return attribute.value.expression?.type !== "JSXEmptyExpression";
    }
  }
  return false;
}
