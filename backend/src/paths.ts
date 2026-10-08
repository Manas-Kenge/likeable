import { posix } from "node:path";
export const BASE_PATH = "/home/user/app";
const excluded = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".cache",
  ".next",
  ".vite",
  "coverage",
  ".npmrc",
  ".yarnrc",
]);
export function includeInSnapshot(path: string): boolean {
  return (
    !path
      .split("/")
      .some((part) => excluded.has(part) || part.startsWith(".env")) &&
    !/\.(?:tsbuildinfo|log|pem|key)$/.test(path)
  );
}
export function projectPath(path: string): string {
  if (
    !path.trim() ||
    path.includes("\0") ||
    path.includes("\\") ||
    posix.isAbsolute(path) ||
    path.split("/").includes("..") ||
    !includeInSnapshot(path)
  )
    throw new Error(
      "File path must be a source file inside the project directory",
    );
  const normalized = posix.normalize(path);
  if (normalized === "." || normalized.startsWith("../"))
    throw new Error("Invalid project file path");
  return `${BASE_PATH}/${normalized}`;
}
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
