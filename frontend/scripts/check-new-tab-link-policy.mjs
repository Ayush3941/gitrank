import {
  readElementName,
  readStringAttribute,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (violations.length > 0) {
  console.error("New-tab link policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    'Links with target="_blank" must set rel="noopener noreferrer" and include <NewTabHint />.',
  );
  process.exit(1);
}

console.log("New-tab link policy check passed");

function checkElement({ element, openingElement, relativePath }) {
  if (readStringAttribute(openingElement.attributes ?? [], "target") !== "_blank") {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  const rel = readStringAttribute(openingElement.attributes ?? [], "rel") ?? "";
  const relTokens = new Set(rel.split(/\s+/).filter(Boolean));
  if (!relTokens.has("noopener") || !relTokens.has("noreferrer")) {
    violations.push(`${relativePath}:${line} target="_blank" is missing rel="noopener noreferrer"`);
  }
  if (!hasDescendantTag(element.children ?? [], "NewTabHint")) {
    violations.push(`${relativePath}:${line} target="_blank" is missing <NewTabHint />`);
  }
}

function hasDescendantTag(nodes, expectedTagName) {
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }
    if (
      node.type === "JSXElement"
      && readElementName(node.openingElement.name) === expectedTagName
    ) {
      return true;
    }
    if (
      node.type === "JSXElement"
      && hasDescendantTag(node.children ?? [], expectedTagName)
    ) {
      return true;
    }
    if (
      node.type === "JSXExpressionContainer"
      && hasDescendantTag([node.expression], expectedTagName)
    ) {
      return true;
    }
  }
  return false;
}
