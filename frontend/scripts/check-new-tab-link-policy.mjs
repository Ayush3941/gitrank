import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import parser from "@babel/parser";

const { parse } = parser;
const root = process.cwd();
const scanRoots = ["app", "components", "features"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

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

function walk(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) {
    return;
  }
  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      if (ignoredDirs.has(child)) {
        continue;
      }
      walk(path.join(entry, child));
    }
    return;
  }
  if (!/\.[cm]?[jt]sx?$/.test(entry)) {
    return;
  }

  const relative = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");
  scanSource(relative, source);
}

function scanSource(relativePath, source) {
  let ast;
  try {
    ast = parse(source, {
      sourceType: "module",
      errorRecovery: true,
      plugins: ["jsx", "typescript"],
    });
  } catch (error) {
    violations.push(`${relativePath}: failed to parse (${error.message})`);
    return;
  }

  visitNode(ast.program, relativePath);
}

function visitNode(node, relativePath) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      visitNode(child, relativePath);
    }
    return;
  }

  if (node.type === "JSXElement") {
    checkElement(node, relativePath);
  }

  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    visitNode(value, relativePath);
  }
}

function checkElement(element, relativePath) {
  const opening = element.openingElement;
  if (readStringAttribute(opening.attributes ?? [], "target") !== "_blank") {
    return;
  }

  const line = opening.loc?.start?.line ?? 1;
  const rel = readStringAttribute(opening.attributes ?? [], "rel") ?? "";
  const relTokens = new Set(rel.split(/\s+/).filter(Boolean));
  if (!relTokens.has("noopener") || !relTokens.has("noreferrer")) {
    violations.push(`${relativePath}:${line} target="_blank" is missing rel="noopener noreferrer"`);
  }
  if (!hasDescendantTag(element.children ?? [], "NewTabHint")) {
    violations.push(`${relativePath}:${line} target="_blank" is missing <NewTabHint />`);
  }
}

function readStringAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (
      attribute?.type !== "JSXAttribute"
      || attribute.name?.type !== "JSXIdentifier"
      || attribute.name.name !== name
    ) {
      continue;
    }
    return attribute.value?.type === "StringLiteral"
      ? attribute.value.value
      : null;
  }
  return null;
}

function hasDescendantTag(nodes, expectedTagName) {
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }
    if (
      node.type === "JSXElement"
      && node.openingElement.name?.type === "JSXIdentifier"
      && node.openingElement.name.name === expectedTagName
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
