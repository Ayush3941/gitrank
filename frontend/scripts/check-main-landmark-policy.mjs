import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import parser from "@babel/parser";

const { parse } = parser;
const root = process.cwd();
const scanRoots = ["app", "components", "features"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
const allowedMainPath = "components/shared/AppShell.tsx";
const violations = [];
let mainCount = 0;

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (mainCount !== 1) {
  violations.push(`expected exactly one frontend <main> landmark, found ${mainCount}`);
}

if (violations.length > 0) {
  console.error("Main landmark policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "AppShell owns <main id=\"main-content\">. Route content should render sections or divs inside that shell.",
  );
  process.exit(1);
}

console.log("Main landmark policy check passed");

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
  if (readTagName(opening.name) !== "main") {
    return;
  }

  mainCount += 1;
  const line = opening.loc?.start?.line ?? 1;
  if (relativePath !== allowedMainPath) {
    violations.push(`${relativePath}:${line} renders <main> outside AppShell`);
    return;
  }
  if (readStringAttribute(opening.attributes ?? [], "id") !== "main-content") {
    violations.push(`${relativePath}:${line} AppShell <main> must keep id="main-content"`);
  }
  if (readNumberAttribute(opening.attributes ?? [], "tabIndex") !== -1) {
    violations.push(`${relativePath}:${line} AppShell <main> must keep tabIndex={-1} for skip-link focus`);
  }
}

function readTagName(nameNode) {
  if (nameNode?.type !== "JSXIdentifier") {
    return null;
  }
  const name = nameNode.name;
  if (!name || name[0] !== name[0].toLowerCase()) {
    return null;
  }
  return name;
}

function readStringAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (
      attribute?.type !== "JSXAttribute" ||
      attribute.name?.type !== "JSXIdentifier" ||
      attribute.name.name !== name
    ) {
      continue;
    }
    if (attribute.value?.type === "StringLiteral") {
      return attribute.value.value;
    }
    if (
      attribute.value?.type === "JSXExpressionContainer" &&
      attribute.value.expression?.type === "StringLiteral"
    ) {
      return attribute.value.expression.value;
    }
  }
  return null;
}

function readNumberAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (
      attribute?.type !== "JSXAttribute" ||
      attribute.name?.type !== "JSXIdentifier" ||
      attribute.name.name !== name
    ) {
      continue;
    }
    if (
      attribute.value?.type === "JSXExpressionContainer" &&
      attribute.value.expression?.type === "UnaryExpression" &&
      attribute.value.expression.operator === "-" &&
      attribute.value.expression.argument.type === "NumericLiteral"
    ) {
      return -attribute.value.expression.argument.value;
    }
    if (
      attribute.value?.type === "JSXExpressionContainer" &&
      attribute.value.expression?.type === "NumericLiteral"
    ) {
      return attribute.value.expression.value;
    }
  }
  return null;
}
