import type { Sandbox } from "e2b";
import { BASE_PATH, includeInSnapshot, projectPath, shellQuote } from "./paths";
import type { SnapshotFile } from "./store";

export async function safeSandboxPath(
  sandbox: Sandbox,
  path: string,
): Promise<string> {
  const fullPath = projectPath(path);
  const result = await sandbox.commands.run(
    `realpath -m -- ${shellQuote(fullPath)}`,
    { timeoutMs: 5000 },
  );
  const resolved = result.stdout.trim();
  if (
    result.exitCode !== 0 ||
    !resolved.startsWith(`${BASE_PATH}/`) ||
    !includeInSnapshot(resolved.slice(BASE_PATH.length + 1))
  )
    throw new Error("File path resolves outside the project source directory");
  return fullPath;
}
export async function listSourceFiles(sandbox: Sandbox): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string, depth = 0) {
    if (depth > 30)
      throw new Error("Project file tree exceeds the supported nesting depth");
    for (const entry of await sandbox.files.list(directory)) {
      const path = `${directory}/${entry.name}`;
      const relative = path.slice(BASE_PATH.length + 1);
      if (!includeInSnapshot(relative) || entry.symlinkTarget) continue;
      if (entry.type === "dir") await visit(path, depth + 1);
      else if (entry.type === "file") files.push(relative);
    }
  }
  await visit(BASE_PATH);
  return files.sort();
}
export async function captureFiles(sandbox: Sandbox): Promise<SnapshotFile[]> {
  const paths = await listSourceFiles(sandbox);
  const snapshot: SnapshotFile[] = [];
  let bytes = 0;
  for (const path of paths) {
    await safeSandboxPath(sandbox, path);
    const content = await sandbox.files.read(projectPath(path), {
      format: "bytes",
    });
    bytes += content.length;
    if (bytes > 50 * 1024 * 1024)
      throw new Error("Project source exceeds the 50 MB snapshot limit");
    snapshot.push({ path, content });
  }
  return snapshot;
}
export async function waitForPreview(sandbox: Sandbox): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const result = await sandbox.commands.run(
        'curl --max-time 2 -s -o /dev/null -w "%{http_code}" http://localhost:5173',
        { timeoutMs: 3000 },
      );
      if (result.stdout.trim() === "200") return;
    } catch {
      /* The server may still be starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "The preview server did not become ready. Reopen the project to try again.",
  );
}
