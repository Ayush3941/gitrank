import {
  hasAttribute,
  readElementName,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const imageTags = new Set(["img", "Image"]);
const violations = [];

violations.push(...scanJSXFiles({
  onElement: checkImageElement,
}));

if (violations.length > 0) {
  console.error("Image alt-text check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Every production image must declare alt. Use alt=\"\" only for intentionally decorative images with nearby or wrapper-level accessible text.",
  );
  process.exit(1);
}

console.log("Image alt-text check passed");

function checkImageElement({ openingElement, relativePath }) {
  const tagName = readElementName(openingElement.name);
  if (!imageTags.has(tagName)) {
    return;
  }
  if (hasAttribute(openingElement.attributes ?? [], "alt")) {
    return;
  }

  const line = openingElement.loc?.start?.line ?? 1;
  violations.push(`${relativePath}:${line} <${tagName}> is missing an explicit alt attribute`);
}
