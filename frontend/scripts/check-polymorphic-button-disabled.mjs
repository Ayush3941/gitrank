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
  console.error("Polymorphic button disabled-state check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Do not pass disabled to <Button asChild>. Render a real disabled button, or remove the link/action entirely until it is operable.",
  );
  process.exit(1);
}

console.log("Polymorphic button disabled-state check passed");

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

  if (node.type === "JSXOpeningElement") {
    checkOpeningElement(node, relativePath);
  }

  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    visitNode(value, relativePath);
  }
}

function checkOpeningElement(opening, relativePath) {
  const tagName =
    opening.name?.type === "JSXIdentifier" ? opening.name.name : "";
  if (tagName !== "Button") {
    return;
  }

  const attributes = opening.attributes ?? [];
  if (!hasAttribute(attributes, "asChild") || !hasAttribute(attributes, "disabled")) {
    return;
  }

  const line = opening.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} <Button asChild> must not receive disabled`);
}

function hasAttribute(attributes, name) {
  return attributes.some(
    (attribute) =>
      attribute?.type === "JSXAttribute"
      && attribute.name?.type === "JSXIdentifier"
      && attribute.name.name === name,
  );
}
