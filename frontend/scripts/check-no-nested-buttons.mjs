import {
  hasAttribute,
  readElementName,
  readStringAttribute,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const violations = [];

violations.push(...scanJSXFiles({
  onProgram: ({ program, relativePath }) => {
    visitNode(program, [], relativePath);
  },
  visitElements: false,
}));

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
  const tagName = readNativeTagName(opening.name);
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

function readNativeTagName(nameNode) {
  const name = readElementName(nameNode);
  if (!name || name[0] !== name[0].toLowerCase()) {
    return null;
  }
  return name;
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
