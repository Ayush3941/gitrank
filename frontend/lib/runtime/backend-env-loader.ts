import fs from "node:fs";
import path from "node:path";

const DEFAULT_BACKEND_ENV_RELATIVE_PATH = path.join("..", "gitrank", ".env");

export type BackendEnvLoadResult = {
  envFilePath: string;
  loadedCount: number;
  loadedKeys: string[];
  exists: boolean;
};

export function loadBackendEnvDefaultsForFrontend(configDir: string = process.cwd()): BackendEnvLoadResult {
  const envFilePath = path.resolve(configDir, DEFAULT_BACKEND_ENV_RELATIVE_PATH);
  if (!fs.existsSync(envFilePath)) {
    return {
      envFilePath,
      loadedCount: 0,
      loadedKeys: [],
      exists: false,
    };
  }

  const raw = fs.readFileSync(envFilePath, "utf8");
  const loadedKeys: string[] = [];
  const lines = raw.split(/\r?\n/g);
  for (const line of lines) {
    const parsed = parseBackendEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (typeof process.env[parsed.key] !== "undefined") {
      continue;
    }
    process.env[parsed.key] = parsed.value;
    loadedKeys.push(parsed.key);
  }

  return {
    envFilePath,
    loadedCount: loadedKeys.length,
    loadedKeys,
    exists: true,
  };
}

type ParsedBackendEnvLine = {
  key: string;
  value: string;
};

function parseBackendEnvLine(line: string): ParsedBackendEnvLine | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const separatorIndex = normalized.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  if (!key || /[^A-Za-z0-9_]/.test(key)) {
    return null;
  }

  const rawValue = normalized.slice(separatorIndex + 1).trim();
  const value = unquoteBackendEnvValue(rawValue);
  return { key, value };
}

function unquoteBackendEnvValue(value: string): string {
  if (value.length < 2) {
    return stripUnquotedInlineComment(value);
  }

  const quote = value[0];
  if (quote !== "\"" && quote !== "'") {
    return stripUnquotedInlineComment(value);
  }

  const closingQuoteIndex = findClosingQuoteIndex(value, quote);
  if (closingQuoteIndex <= 0) {
    return stripUnquotedInlineComment(value);
  }

  const inner = value.slice(1, closingQuoteIndex);
  if (quote === "'") {
    return inner;
  }
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

function findClosingQuoteIndex(value: string, quote: string): number {
  for (let index = 1; index < value.length; index += 1) {
    if (value[index] !== quote) {
      continue;
    }
    if (quote === "\"" && value[index - 1] === "\\") {
      continue;
    }
    return index;
  }
  return -1;
}

function stripUnquotedInlineComment(value: string): string {
  const input = value.trimEnd();
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] !== "#") {
      continue;
    }
    if (index === 0 || /\s/.test(input[index - 1] ?? "")) {
      return input.slice(0, index).trimEnd();
    }
  }
  return input;
}
