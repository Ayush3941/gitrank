import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import parser from "@babel/parser";

const { parse } = parser;
const root = process.cwd();
const scanRoots = ["app", "components", "features"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);
const delegatedIconComponents = new Set(["SignalIcon"]);
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Decorative icon semantics check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    'Mark visual-only Lucide icons with aria-hidden="true". Keep the adjacent text as the accessible authority.',
  );
  process.exit(1);
}

console.log("Decorative icon semantics check passed");

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

  const lucideNames = collectLucideNames(ast.program.body);
  visitNode(ast.program, relativePath, lucideNames);
}

function collectLucideNames(body) {
  const names = new Set();
  for (const statement of body) {
    if (
      statement?.type !== "ImportDeclaration"
      || statement.source?.value !== "lucide-react"
    ) {
      continue;
    }
    for (const specifier of statement.specifiers ?? []) {
      if (specifier?.type === "ImportSpecifier" && specifier.local?.name) {
        names.add(specifier.local.name);
      }
    }
  }
  return names;
}

function visitNode(node, relativePath, lucideNames) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      visitNode(child, relativePath, lucideNames);
    }
    return;
  }

  if (node.type === "JSXOpeningElement") {
    checkOpeningElement(node, relativePath, lucideNames);
  }

  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    visitNode(value, relativePath, lucideNames);
  }
}

function checkOpeningElement(opening, relativePath, lucideNames) {
  const tagName =
    opening.name?.type === "JSXIdentifier" ? opening.name.name : "";
  const needsExplicitDecorativeSemantics =
    lucideNames.has(tagName)
    || (
      !delegatedIconComponents.has(tagName)
      && (tagName === "Icon" || tagName.endsWith("Icon"))
    );
  if (
    !needsExplicitDecorativeSemantics
    || hasTrueAriaHidden(opening.attributes ?? [])
  ) {
    return;
  }

  const line = opening.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} <${tagName}> is missing aria-hidden="true"`);
}

function hasTrueAriaHidden(attributes) {
  for (const attribute of attributes) {
    if (
      attribute?.type !== "JSXAttribute"
      || attribute.name?.type !== "JSXIdentifier"
      || attribute.name.name !== "aria-hidden"
    ) {
      continue;
    }
    const value = attribute.value;
    if (value?.type === "StringLiteral") {
      return value.value === "true";
    }
    if (value?.type === "JSXExpressionContainer") {
      return value.expression?.type === "BooleanLiteral"
        && value.expression.value === true;
    }
  }
  return false;
}
