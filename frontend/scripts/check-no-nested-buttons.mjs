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
  console.error("Nested interactive guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Do not nest interactive elements. Use one interactive root and compose styling with asChild/polymorphic patterns.",
  );
  process.exit(1);
}

console.log("Nested interactive guard passed");

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
  scanForNestedInteractive(relative, source);
}

function scanForNestedInteractive(relativePath, source) {
  let ast;
  try {
    ast = parse(source, {
      sourceType: "module",
      errorRecovery: true,
      plugins: ["jsx", "typescript"],
    });
  } catch (error) {
    violations.push(`${relativePath}: failed to parse for nested interactive guard (${error.message})`);
    return;
  }

  visitNode(ast.program, [], relativePath);
}

function visitNode(node, interactiveStack, relativePath) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      visitNode(child, interactiveStack, relativePath);
    }
    return;
  }

  if (node.type === "JSXElement") {
    visitJSXElement(node, interactiveStack, relativePath);
    return;
  }

  if (node.type === "JSXFragment") {
    for (const child of node.children ?? []) {
      visitNode(child, interactiveStack, relativePath);
    }
    return;
  }

  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    visitNode(value, interactiveStack, relativePath);
  }
}

function visitJSXElement(node, interactiveStack, relativePath) {
  const opening = node.openingElement;
  const tagName = readTagName(opening.name);
  const interactive = interactiveKind(tagName, opening.attributes ?? []);
  const line = opening.loc?.start?.line ?? 1;

  if (interactive && interactiveStack.length > 0) {
    const parent = interactiveStack[interactiveStack.length - 1];
    violations.push(
      `${relativePath}:${line} has nested interactive elements: <${tagName}> (${interactive}) inside <${parent.tagName}> (${parent.interactive}) at line ${parent.line}`,
    );
  }

  const nextStack = interactive
    ? [...interactiveStack, { tagName, interactive, line }]
    : interactiveStack;

  if (opening.selfClosing) {
    return;
  }

  for (const child of node.children ?? []) {
    visitNode(child, nextStack, relativePath);
  }
}

function readTagName(nameNode) {
  if (!nameNode) {
    return null;
  }
  if (nameNode.type === "JSXIdentifier") {
    const name = nameNode.name;
    if (!name || name[0] !== name[0].toLowerCase()) {
      return null;
    }
    return name;
  }
  return null;
}

function interactiveKind(tagName, attributes) {
  if (!tagName) {
    return null;
  }

  if (tagName === "button") return "button";
  if (tagName === "input") return "input";
  if (tagName === "select") return "select";
  if (tagName === "textarea") return "textarea";
  if (tagName === "details") return "details";
  if (tagName === "summary") return "summary";
  if (tagName === "a" && hasAttribute(attributes, "href")) return "link";

  const roleValue = readStringAttribute(attributes, "role");
  if (roleValue && ["button", "link", "tab", "switch", "checkbox", "menuitem"].includes(roleValue.toLowerCase())) {
    return `role=${roleValue.toLowerCase()}`;
  }

  const tabIndexValue = readTabIndexAttribute(attributes);
  if (tabIndexValue !== null && tabIndexValue >= 0) {
    return "tabindex-focusable";
  }

  return null;
}

function hasAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (attribute?.type !== "JSXAttribute") {
      continue;
    }
    if (attribute.name?.type !== "JSXIdentifier") {
      continue;
    }
    if (attribute.name.name === name) {
      return true;
    }
  }
  return false;
}

function readStringAttribute(attributes, name) {
  for (const attribute of attributes) {
    if (attribute?.type !== "JSXAttribute") {
      continue;
    }
    if (attribute.name?.type !== "JSXIdentifier" || attribute.name.name !== name) {
      continue;
    }
    const value = attribute.value;
    if (!value) {
      return "";
    }
    if (value.type === "StringLiteral") {
      return value.value;
    }
    if (value.type === "JSXExpressionContainer" && value.expression?.type === "StringLiteral") {
      return value.expression.value;
    }
  }
  return null;
}

function readTabIndexAttribute(attributes) {
  for (const attribute of attributes) {
    if (attribute?.type !== "JSXAttribute") {
      continue;
    }
    if (attribute.name?.type !== "JSXIdentifier" || attribute.name.name.toLowerCase() !== "tabindex") {
      continue;
    }
    const value = attribute.value;
    if (!value) {
      return 0;
    }
    if (value.type === "StringLiteral") {
      const parsed = Number(value.value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (value.type === "JSXExpressionContainer") {
      const expression = value.expression;
      if (!expression) {
        return null;
      }
      if (expression.type === "NumericLiteral") {
        return expression.value;
      }
      if (expression.type === "StringLiteral") {
        const parsed = Number(expression.value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }
  }
  return null;
}
