import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const productionRoots = ["app", "components", "features", "hooks", "lib"];
const candidateRoots = ["components/shared", "components/ui", "hooks"];
const ignoredDirs = new Set([".next", "node_modules", "tests", "docs", "scripts"]);
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mdx"]);
const candidates = [];
const productionFiles = [];

for (const productionRoot of productionRoots) {
  collectSourceFiles(path.join(root, productionRoot), productionFiles);
}

for (const candidateRoot of candidateRoots) {
  collectSourceFiles(path.join(root, candidateRoot), candidates);
}

const productionSources = productionFiles.map((file) => ({
  file,
  source: readFileSync(file, "utf8"),
}));

const violations = [];

for (const candidate of candidates) {
  const relativePath = normalizePath(path.relative(root, candidate));
  const modulePath = stripExtension(relativePath);
  const modulePathWithoutIndex = modulePath.endsWith("/index")
    ? modulePath.slice(0, -"/index".length)
    : modulePath;
  const aliasPath = `@/${modulePath}`;
  const aliasPathWithoutIndex = `@/${modulePathWithoutIndex}`;
  const importTokens = new Set([
    aliasPath,
    aliasPathWithoutIndex,
    modulePath,
    modulePathWithoutIndex,
  ]);

  let referenced = false;
  for (const { file, source } of productionSources) {
    if (file === candidate) {
      continue;
    }
    if (hasModuleReference(source, importTokens)) {
      referenced = true;
      break;
    }
  }

  if (!referenced) {
    violations.push(`${relativePath} has no production import outside itself`);
  }
}

if (violations.length > 0) {
  console.error("Shared orphan check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "Remove unused shared components/hooks, or wire them through production code before keeping dedicated tests.",
  );
  process.exit(1);
}

console.log("Shared orphan check passed");

function collectSourceFiles(entry, output) {
  const stat = statSync(entry, { throwIfNoEntry: false });
  if (!stat) {
    return;
  }
  if (stat.isDirectory()) {
    for (const child of readdirSync(entry)) {
      if (ignoredDirs.has(child)) {
        continue;
      }
      collectSourceFiles(path.join(entry, child), output);
    }
    return;
  }
  if (!sourceExtensions.has(path.extname(entry))) {
    return;
  }
  output.push(entry);
}

function hasModuleReference(source, importTokens) {
  for (const token of importTokens) {
    if (source.includes(`"${token}"`) || source.includes(`'${token}'`)) {
      return true;
    }
  }
  return false;
}

function stripExtension(filePath) {
  const extension = path.extname(filePath);
  return extension ? filePath.slice(0, -extension.length) : filePath;
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}
