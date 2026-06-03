import {
  hasAttribute,
  readElementName,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

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

function checkElement({ openingElement, relativePath }) {
  const tagName = readElementName(openingElement.name);
  if (tagName !== "Button") {
    return;
  }

  const attributes = openingElement.attributes ?? [];
  if (!hasAttribute(attributes, "asChild") || !hasAttribute(attributes, "disabled")) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} <Button asChild> must not receive disabled`);
}
