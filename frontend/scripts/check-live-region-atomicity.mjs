import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import parser from "@babel/parser";

const { parse } = parser;
const root = process.cwd();
const scanRoots = ["app", "components", "features"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
const liveRegionRoles = new Set(["alert", "status"]);
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Live-region atomicity check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error('Elements with role="status" or role="alert" must set aria-atomic="true".');
  process.exit(1);
}

console.log("Live-region atomicity check passed");

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

  const relativePath = path.relative(root, entry).split(path.sep).join("/");
  const source = readFileSync(entry, "utf8");
  scanSource(relativePath, source);
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
    checkElement(node.openingElement, relativePath);
  }

  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    visitNode(value, relativePath);
  }
}

function checkElement(openingElement, relativePath) {
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

function readStringAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (
      attribute?.type !== "JSXAttribute"
      || attribute.name?.type !== "JSXIdentifier"
      || attribute.name.name !== name
    ) {
      continue;
    }
    if (attribute.value?.type === "StringLiteral") {
      return attribute.value.value;
    }
    if (
      attribute.value?.type === "JSXExpressionContainer"
      && attribute.value.expression?.type === "StringLiteral"
    ) {
      return attribute.value.expression.value;
    }
  }
  return null;
}

function readBooleanishAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (
      attribute?.type !== "JSXAttribute"
      || attribute.name?.type !== "JSXIdentifier"
      || attribute.name.name !== name
    ) {
      continue;
    }
    if (attribute.value?.type === "StringLiteral") {
      return attribute.value.value === "true";
    }
    if (
      attribute.value?.type === "JSXExpressionContainer"
      && attribute.value.expression?.type === "StringLiteral"
    ) {
      return attribute.value.expression.value === "true";
    }
    if (
      attribute.value?.type === "JSXExpressionContainer"
      && attribute.value.expression?.type === "BooleanLiteral"
    ) {
      return attribute.value.expression.value;
    }
  }
  return null;
}
