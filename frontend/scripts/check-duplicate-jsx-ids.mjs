#!/usr/bin/env node
import {
  readStringAttribute,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const duplicates = [];
const fileIdCounts = new Map();

duplicates.push(...scanJSXFiles({ onElement: collectLiteralId }));

for (const [file, counts] of fileIdCounts) {
  for (const [id, count] of counts) {
    if (count > 1) {
      duplicates.push({
        file,
        id,
        count,
      });
    }
  }
}

if (duplicates.length > 0) {
  console.error("Duplicate literal JSX ids detected:");
  for (const dup of duplicates) {
    if (typeof dup === "string") {
      console.error(`- ${dup}`);
    } else {
      console.error(`- ${dup.file}: id="${dup.id}" appears ${dup.count} times`);
    }
  }
  console.error(
    "Use one stable container id per region (or unique ids) to avoid accessibility/anchor collisions.",
  );
  process.exit(1);
}

console.log("Duplicate literal JSX id check passed");

function collectLiteralId({ openingElement, relativePath }) {
  const id = readStringAttribute(openingElement.attributes ?? [], "id");
  if (!id) {
    return;
  }
  const counts = fileIdCounts.get(relativePath) ?? new Map();
  counts.set(id, (counts.get(id) ?? 0) + 1);
  fileIdCounts.set(relativePath, counts);
}
