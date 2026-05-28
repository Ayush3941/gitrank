import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadBackendEnvDefaultsForFrontend } from "@/lib/runtime/backend-env-loader";

const TMP_DIR_PREFIX = "gitrank-backend-env-loader-";

describe("loadBackendEnvDefaultsForFrontend", () => {
  const touchedKeys = ["GITRANK_TEST_RUNTIME_A", "NEXT_PUBLIC_GITRANK_TEST_RUNTIME_B", "OPENAI_TEST_RUNTIME_C"] as const;
  const tmpRoots: string[] = [];

  afterEach(() => {
    for (const key of touchedKeys) {
      delete process.env[key];
    }
    while (tmpRoots.length > 0) {
      const root = tmpRoots.pop();
      if (root && fs.existsSync(root)) {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("loads missing frontend runtime variables from ../gitrank/.env", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), TMP_DIR_PREFIX));
    tmpRoots.push(root);

    const frontendDir = path.join(root, "frontend");
    const backendDir = path.join(root, "gitrank");
    fs.mkdirSync(frontendDir, { recursive: true });
    fs.mkdirSync(backendDir, { recursive: true });
    fs.writeFileSync(
      path.join(backendDir, ".env"),
      [
        "GITRANK_TEST_RUNTIME_A=http://localhost:3000",
        "NEXT_PUBLIC_GITRANK_TEST_RUNTIME_B=gitrank_csrf",
        "OPENAI_TEST_RUNTIME_C=\"sk-test\"",
      ].join("\n"),
      "utf8",
    );

    const result = loadBackendEnvDefaultsForFrontend(frontendDir);
    expect(result.exists).toBe(true);
    expect(result.loadedCount).toBe(3);
    expect(process.env.GITRANK_TEST_RUNTIME_A).toBe("http://localhost:3000");
    expect(process.env.NEXT_PUBLIC_GITRANK_TEST_RUNTIME_B).toBe("gitrank_csrf");
    expect(process.env.OPENAI_TEST_RUNTIME_C).toBe("sk-test");
  });

  it("does not override existing process environment values", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), TMP_DIR_PREFIX));
    tmpRoots.push(root);

    const frontendDir = path.join(root, "frontend");
    const backendDir = path.join(root, "gitrank");
    fs.mkdirSync(frontendDir, { recursive: true });
    fs.mkdirSync(backendDir, { recursive: true });
    fs.writeFileSync(
      path.join(backendDir, ".env"),
      "NEXT_PUBLIC_GITRANK_TEST_RUNTIME_B=gitrank_csrf\n",
      "utf8",
    );

    process.env.NEXT_PUBLIC_GITRANK_TEST_RUNTIME_B = "already-set";

    const result = loadBackendEnvDefaultsForFrontend(frontendDir);
    expect(result.exists).toBe(true);
    expect(result.loadedCount).toBe(0);
    expect(process.env.NEXT_PUBLIC_GITRANK_TEST_RUNTIME_B).toBe("already-set");
  });

  it("returns exists=false when backend .env does not exist", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), TMP_DIR_PREFIX));
    tmpRoots.push(root);
    const frontendDir = path.join(root, "frontend");
    fs.mkdirSync(frontendDir, { recursive: true });

    const result = loadBackendEnvDefaultsForFrontend(frontendDir);
    expect(result.exists).toBe(false);
    expect(result.loadedCount).toBe(0);
  });

  it("strips inline comments for unquoted values and preserves quoted hashes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), TMP_DIR_PREFIX));
    tmpRoots.push(root);

    const frontendDir = path.join(root, "frontend");
    const backendDir = path.join(root, "gitrank");
    fs.mkdirSync(frontendDir, { recursive: true });
    fs.mkdirSync(backendDir, { recursive: true });
    fs.writeFileSync(
      path.join(backendDir, ".env"),
      [
        "GITRANK_TEST_RUNTIME_A=enabled # local toggle",
        "NEXT_PUBLIC_GITRANK_TEST_RUNTIME_B=\"value#kept\" # trailing comment",
      ].join("\n"),
      "utf8",
    );

    const result = loadBackendEnvDefaultsForFrontend(frontendDir);
    expect(result.exists).toBe(true);
    expect(result.loadedCount).toBe(2);
    expect(process.env.GITRANK_TEST_RUNTIME_A).toBe("enabled");
    expect(process.env.NEXT_PUBLIC_GITRANK_TEST_RUNTIME_B).toBe("value#kept");
  });
});
