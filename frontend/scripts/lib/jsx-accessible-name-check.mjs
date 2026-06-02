import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import parser from "@babel/parser";

const { parse } = parser;
const defaultScanRoots = ["app", "components", "features"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);

export function runAccessibleNameCheck({
  checkLabel,
  tagNames,
  ignoredFiles = [],
  failureMessage,
  successMessage,
  root = process.cwd(),
  scanRoots = defaultScanRoots,
}) {
  const tagNameSet = new Set(tagNames);
  const ignoredFileSet = new Set(ignoredFiles);
  const violations = [];

  for (const scanRoot of scanRoots) {
    walk(path.join(root, scanRoot), {
      root,
      tagNameSet,
      ignoredFileSet,
      violations,
    });
  }

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

function walk(entry, context) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) {
    return;
  }
  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      if (ignoredDirs.has(child)) {
        continue;
      }
      walk(path.join(entry, child), context);
    }
    return;
  }
  if (!/\.[cm]?[jt]sx?$/.test(entry)) {
    return;
  }

  const relative = path.relative(context.root, entry).split(path.sep).join("/");
  if (context.ignoredFileSet.has(relative)) {
    return;
  }
  const source = readFileSync(entry, "utf8");
  scanSource(relative, source, context);
}

function scanSource(relativePath, source, context) {
  let ast;
  try {
    ast = parse(source, {
      sourceType: "module",
      errorRecovery: true,
      plugins: ["jsx", "typescript"],
    });
  } catch (error) {
    context.violations.push(`${relativePath}: failed to parse (${error.message})`);
    return;
  }

  visitNode(ast.program, relativePath, context);
}

function visitNode(node, relativePath, context) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      visitNode(child, relativePath, context);
    }
    return;
  }

  if (node.type === "JSXElement") {
    checkElement(node, relativePath, context);
  }

  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    visitNode(value, relativePath, context);
  }
}

function checkElement(element, relativePath, context) {
  const opening = element.openingElement;
  const tagName = readTagName(opening.name);
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

function readTagName(nameNode) {
  if (nameNode?.type !== "JSXIdentifier") {
    return null;
  }
  return nameNode.name;
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
