import { readFileSync } from "node:fs";
import path from "node:path";

const cssPath = path.join(process.cwd(), "app", "globals.css");
const source = readFileSync(cssPath, "utf8");

const tokens = parseTokens(source);
const checks = [
  { name: "foreground on background", fg: "foreground", bg: "background", min: 4.5 },
  { name: "foreground on card", fg: "foreground", bg: "card", min: 4.5 },
  { name: "foreground on card-2", fg: "foreground", bg: "card-2", min: 4.5 },
  { name: "muted on background", fg: "muted", bg: "background", min: 4.5 },
  { name: "muted on card", fg: "muted", bg: "card", min: 4.5 },
  { name: "primary on background", fg: "primary", bg: "background", min: 3.0 },
  { name: "danger on background", fg: "danger", bg: "background", min: 3.0 },
];

const violations = [];

for (const check of checks) {
  const fg = tokens.get(check.fg);
  const bg = tokens.get(check.bg);
  if (!fg || !bg) {
    violations.push(`${check.name}: missing token(s)`);
    continue;
  }
  const ratio = contrastRatio(fg, bg);
  console.log(`${check.name}: ${ratio.toFixed(2)}:1`);
  if (ratio < check.min) {
    violations.push(
      `${check.name}: ${ratio.toFixed(2)}:1 is below required ${check.min.toFixed(1)}:1`,
    );
  }
}

if (violations.length > 0) {
  console.error("Contrast token check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

function parseTokens(css) {
  const map = new Map();
  const tokenRegex = /--([a-z0-9-]+)\s*:\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\s*;/gi;
  let match;
  while ((match = tokenRegex.exec(css)) !== null) {
    map.set(match[1], [Number(match[2]), Number(match[3]), Number(match[4])]);
  }
  return map;
}

function contrastRatio(fg, bg) {
  const fgL = relativeLuminance(fg);
  const bgL = relativeLuminance(bg);
  const lighter = Math.max(fgL, bgL);
  const darker = Math.min(fgL, bgL);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance([r, g, b]) {
  const channels = [r, g, b].map((value) => {
    const sRGB = value / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : ((sRGB + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
