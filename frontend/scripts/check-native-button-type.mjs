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
  console.error("Native button type check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    'Every literal <button> must declare type="button", type="submit", or type="reset". Use the shared <Button> primitive for default button behavior.',
  );
  process.exit(1);
}

console.log("Native button type check passed");

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
  if (readTagName(opening.name) !== "button") {
    return;
  }

  const line = opening.loc?.start?.line ?? 1;
  const typeValue = readStringAttribute(opening.attributes ?? [], "type");
  if (typeValue && ["button", "submit", "reset"].includes(typeValue.toLowerCase())) {
    return;
  }
  violations.push(`${relativePath}:${line} renders <button> without an explicit safe type`);
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
