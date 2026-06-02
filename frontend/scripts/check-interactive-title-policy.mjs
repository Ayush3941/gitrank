import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import parser from "@babel/parser";

const { parse } = parser;
const root = process.cwd();
const scanRoots = ["app", "components", "features"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
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

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

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
  const tagName = readElementName(openingElement.name);
  if (!interactiveNames.has(tagName) || !hasAttribute(openingElement.attributes ?? [], "title")) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} renders interactive <${tagName}> with a title attribute`);
}

function readElementName(nameNode) {
  if (nameNode?.type === "JSXIdentifier") {
    return nameNode.name;
  }
  return "";
}

function hasAttribute(attributes, name) {
  return attributes.some((attribute) => (
    attribute?.type === "JSXAttribute"
    && attribute.name?.type === "JSXIdentifier"
    && attribute.name.name === name
  ));
}
