import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "features"];
const violations = [];

for (const scanRoot of scanRoots) {
  walk(path.join(root, scanRoot));
}

if (violations.length > 0) {
  console.error("Media layout-stability check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Media layout-stability check passed");

function walk(entry) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) return;

  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      if (child === "node_modules" || child === ".next" || child === "dist") continue;
      walk(path.join(entry, child));
    }
    return;
  }

  if (!entry.endsWith(".tsx")) return;
  if (entry.includes(`${path.sep}tests${path.sep}`)) return;

  const source = readFileSync(entry, "utf8");
  const relative = path.relative(root, entry).split(path.sep).join("/");
  checkHtmlImgTags(relative, source);
  checkNextImageTags(relative, source);
}

function checkHtmlImgTags(file, source) {
  const regex = /<img\b[\s\S]*?>/g;
  for (const match of source.matchAll(regex)) {
    const tag = match[0];
    const hasWidth = /\bwidth\s*=/.test(tag);
    const hasHeight = /\bheight\s*=/.test(tag);
    const hasAspectRatio =
      /aspect-ratio/.test(tag) || /aspectRatio/.test(tag);
    if (!hasWidth || !hasHeight) {
      if (!hasAspectRatio) {
        violations.push(
          `${file}: <img> tag is missing width/height or explicit aspect-ratio`,
        );
      }
    }
  }
}

function checkNextImageTags(file, source) {
  const regex = /<Image\b[\s\S]*?\/>/g;
  for (const match of source.matchAll(regex)) {
    const tag = match[0];
    const hasFill = /\bfill\b/.test(tag);
    const hasWidth = /\bwidth\s*=/.test(tag);
    const hasHeight = /\bheight\s*=/.test(tag);
    if (!hasFill && !(hasWidth && hasHeight)) {
      violations.push(
        `${file}: <Image> tag must use fill or include both width and height`,
      );
    }
  }
}
