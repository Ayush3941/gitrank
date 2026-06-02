import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import parser from "@babel/parser";

const { parse } = parser;
const defaultScanRoots = ["app", "components", "features"];
const ignoredDirs = new Set(["node_modules", ".next", "dist", "tests"]);

export function scanJSXFiles({
  root = process.cwd(),
  scanRoots = defaultScanRoots,
  ignoredFiles = [],
  onProgram = () => ({}),
  onElement = () => {},
}) {
  const ignoredFileSet = new Set(ignoredFiles);
  const parseErrors = [];

  for (const scanRoot of scanRoots) {
    walk(path.join(root, scanRoot), {
      ignoredFileSet,
      onElement,
      onProgram,
      parseErrors,
      root,
    });
  }

  return parseErrors;
}

export function readElementName(nameNode) {
  if (nameNode?.type === "JSXIdentifier") {
    return nameNode.name;
  }
  return "";
}

export function hasAttribute(attributes, name) {
  return attributes.some((attribute) => (
    attribute?.type === "JSXAttribute"
    && attribute.name?.type === "JSXIdentifier"
    && attribute.name.name === name
  ));
}

export function readStringAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (!isNamedJSXAttribute(attribute, name)) {
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

export function readBooleanishAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (!isNamedJSXAttribute(attribute, name)) {
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

  const relativePath = path.relative(context.root, entry).split(path.sep).join("/");
  if (context.ignoredFileSet.has(relativePath)) {
    return;
  }

  const source = readFileSync(entry, "utf8");
  scanSource(relativePath, source, context);
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
    context.parseErrors.push(`${relativePath}: failed to parse (${error.message})`);
    return;
  }

  const fileContext = context.onProgram({
    program: ast.program,
    relativePath,
    source,
  }) ?? {};

  visitNode(ast.program, relativePath, {
    ...context,
    fileContext,
  });
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
    context.onElement({
      element: node,
      fileContext: context.fileContext,
      openingElement: node.openingElement,
      relativePath,
    });
  }

  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    visitNode(value, relativePath, context);
  }
}

function isNamedJSXAttribute(attribute, name) {
  return (
    attribute?.type === "JSXAttribute"
    && attribute.name?.type === "JSXIdentifier"
    && attribute.name.name === name
  );
}
