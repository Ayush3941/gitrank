#!/usr/bin/env node
import {
  readExpressionAttribute,
  scanJSXFiles,
} from "./lib/jsx-source-scan.mjs";

const riskyTokens = [
  "label",
  "name",
  "category",
  "skill",
  "signal",
  "point",
  "entry",
  "change",
  "repo",
  "title",
];

const violations = [];

violations.push(...scanJSXFiles({
  scanRoots: ["components", "features"],
  onElement: checkElement,
}));

if (violations.length > 0) {
  console.error("Potentially unstable JSX key patterns detected:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.snippet}`);
  }
  console.error(
    "Use stable unique identifiers (id/owner+repo+number/etc.) or compound keys to avoid duplicate-key render bugs.",
  );
  process.exit(1);
}

console.log("Unstable JSX key check passed");

function checkElement({ fileContext, openingElement, relativePath }) {
  const expression = readExpressionAttribute(openingElement.attributes ?? [], "key");
  const expressionText = expression ? stringifyDirectKeyExpression(expression) : null;
  if (!expressionText) {
    return;
  }

  const normalized = expressionText.toLowerCase();
  const hasStabilityHint =
    normalized.includes(".id") ||
    normalized.includes("item.href") ||
    normalized.includes("item.value") ||
    normalized.includes("step.key") ||
    normalized.includes("datekey");
  const hasRiskyToken = riskyTokens.some((token) => normalized.includes(token));

  if (hasRiskyToken && !hasStabilityHint) {
    violations.push({
      file: relativePath,
      line: openingElement.loc?.start?.line ?? 1,
      snippet: readExpressionSnippet(fileContext.source, expression, expressionText),
    });
  }
}

function stringifyDirectKeyExpression(expression) {
  if (expression.type === "Identifier") {
    return expression.name;
  }
  if (
    expression.type === "MemberExpression"
    || expression.type === "OptionalMemberExpression"
  ) {
    return stringifyMemberExpression(expression);
  }
  return null;
}

function stringifyMemberExpression(expression) {
  if (expression.computed) {
    return null;
  }
  const object = stringifyDirectKeyExpression(expression.object);
  const property = expression.property?.type === "Identifier"
    ? expression.property.name
    : null;
  if (!object || !property) {
    return null;
  }
  return `${object}.${property}`;
}

function readExpressionSnippet(source, expression, fallback) {
  if (
    typeof source === "string"
    && Number.isInteger(expression.start)
    && Number.isInteger(expression.end)
  ) {
    return `key={${source.slice(expression.start, expression.end)}}`;
  }
  return `key={${fallback}}`;
}
