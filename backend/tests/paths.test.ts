import { expect, test } from "bun:test";
import { projectPath, includeInSnapshot, shellQuote } from "../src/paths";
test("file access rejects traversal, absolute paths, secrets and dependency directories", () => {
  for (const path of [
    "../secret",
    "/etc/passwd",
    "src/../../secret",
    ".env",
    ".env.local",
    "node_modules/a.ts",
    "src/\u0000bad",
  ])
    expect(() => projectPath(path)).toThrow();
  expect(projectPath("src/App.tsx")).toBe("/home/user/app/src/App.tsx");
});
test("snapshots include assets and lockfiles but exclude secrets and generated output", () => {
  for (const path of [
    "public/icon.png",
    "package-lock.json",
    "src/App.tsx",
    ".gitignore",
  ])
    expect(includeInSnapshot(path)).toBe(true);
  for (const path of [
    ".env.local",
    "src/.env",
    "node_modules/a.ts",
    "dist/a.js",
    ".git/config",
    ".cache/item",
    "src/App.tsbuildinfo",
  ])
    expect(includeInSnapshot(path)).toBe(false);
});
test("shell quoting treats substitution and quotes as literal path characters", () => {
  expect(shellQuote("a'$(touch /tmp/nope)")).toBe("'a'\\''$(touch /tmp/nope)'");
});
