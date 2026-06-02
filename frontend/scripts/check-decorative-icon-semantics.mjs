import {
  readBooleanishAttribute,
  readElementName,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const delegatedIconComponents = new Set(["SignalIcon"]);
const violations = [];

violations.push(...scanJSXFiles({
  onProgram: ({ program }) => ({
    lucideNames: collectLucideNames(program.body),
  }),
  onElement: checkElement,
}));

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

function checkElement({ fileContext, openingElement, relativePath }) {
  const tagName = readElementName(openingElement.name);
  const lucideNames = fileContext.lucideNames ?? new Set();
  const needsExplicitDecorativeSemantics =
    lucideNames.has(tagName)
    || (
      !delegatedIconComponents.has(tagName)
      && (tagName === "Icon" || tagName.endsWith("Icon"))
    );
  if (
    !needsExplicitDecorativeSemantics
    || readBooleanishAttribute(openingElement.attributes ?? [], "aria-hidden") === true
  ) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} <${tagName}> is missing aria-hidden="true"`);
}
