import {
  readElementName,
  readNumberAttribute,
  readStringAttribute,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const allowedMainPath = "components/shared/AppShell.tsx";
const violations = [];
let mainCount = 0;

violations.push(...scanJSXFiles({ onElement: checkElement }));

if (mainCount !== 1) {
  violations.push(`expected exactly one frontend <main> landmark, found ${mainCount}`);
}

if (violations.length > 0) {
  console.error("Main landmark policy check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "AppShell owns <main id=\"main-content\">. Route content should render sections or divs inside that shell.",
  );
  process.exit(1);
}

console.log("Main landmark policy check passed");

function checkElement({ openingElement, relativePath }) {
  if (readElementName(openingElement.name) !== "main") {
    return;
  }

  mainCount += 1;
  const line = openingElement.loc?.start?.line ?? 1;
  if (relativePath !== allowedMainPath) {
    violations.push(`${relativePath}:${line} renders <main> outside AppShell`);
    return;
  }
  if (readStringAttribute(openingElement.attributes ?? [], "id") !== "main-content") {
    violations.push(`${relativePath}:${line} AppShell <main> must keep id="main-content"`);
  }
  if (readNumberAttribute(openingElement.attributes ?? [], "tabIndex") !== -1) {
    violations.push(`${relativePath}:${line} AppShell <main> must keep tabIndex={-1} for skip-link focus`);
  }
}
