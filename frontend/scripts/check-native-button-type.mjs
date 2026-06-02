import {
  readElementName,
  readStringAttribute,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const violations = [];

violations.push(...scanJSXFiles({ onElement: checkElement }));

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

function checkElement({ element, relativePath }) {
  const opening = element.openingElement;
  if (readElementName(opening.name) !== "button") {
    return;
  }

  const line = opening.loc?.start?.line ?? 1;
  const typeValue = readStringAttribute(opening.attributes ?? [], "type");
  if (typeValue && ["button", "submit", "reset"].includes(typeValue.toLowerCase())) {
    return;
  }
  violations.push(`${relativePath}:${line} renders <button> without an explicit safe type`);
}
