import { readFileSync } from "node:fs";
import path from "node:path";

const cssPath = path.join(process.cwd(), "app", "globals.css");
const source = readFileSync(cssPath, "utf8");

const rootTokens = parseRootTokens(source);
const themeOverrides = parseThemeTokenOverrides(source);
const themes = ["neon", "cyberpunk", "midnight", "terminal", "aurora", "high-contrast"];
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

for (const theme of themes) {
  const mergedTokens = mergeThemeTokens(rootTokens, themeOverrides.get(theme));
  if (theme !== "neon" && !themeOverrides.has(theme)) {
    violations.push(`[${theme}] missing theme override block in globals.css`);
    continue;
  }

  for (const check of checks) {
    const fg = mergedTokens.get(check.fg);
    const bg = mergedTokens.get(check.bg);
    if (!fg || !bg) {
      violations.push(`[${theme}] ${check.name}: missing token(s)`);
      continue;
    }
    const ratio = contrastRatio(fg, bg);
    console.log(`[${theme}] ${check.name}: ${ratio.toFixed(2)}:1`);
    if (ratio < check.min) {
      violations.push(
        `[${theme}] ${check.name}: ${ratio.toFixed(2)}:1 is below required ${check.min.toFixed(1)}:1`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Contrast token check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

function parseRootTokens(css) {
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch) {
    throw new Error("Could not find :root token block in app/globals.css");
  }
  return parseTokens(rootMatch[1]);
}

function parseThemeTokenOverrides(css) {
  const map = new Map();
  const themeRegex = /html\[data-theme="([a-z0-9-]+)"\]\s*\{([^}]*)\}/g;
  let match;
  while ((match = themeRegex.exec(css)) !== null) {
    map.set(match[1], parseTokens(match[2]));
  }
  return map;
}

function mergeThemeTokens(baseTokens, overrideTokens) {
  const merged = new Map(baseTokens);
  if (!overrideTokens) {
    return merged;
  }
  for (const [key, value] of overrideTokens.entries()) {
    merged.set(key, value);
  }
  return merged;
}

function parseTokens(cssBlock) {
  const map = new Map();
  const tokenRegex = /--([a-z0-9-]+)\s*:\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\s*;/gi;
  let match;
  while ((match = tokenRegex.exec(cssBlock)) !== null) {
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
