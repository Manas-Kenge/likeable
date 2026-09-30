import { z } from "zod";
import { tool } from "ai";
import type { Sandbox } from "e2b";
import { BASE_PATH, projectPath, shellQuote } from "./paths";
import { listSourceFiles, safeSandboxPath } from "./sandbox-files";
import { runSandboxCommand } from "./commands";

export function createFileTools(
  sandbox: Sandbox,
  onWrite: (path: string, content: string) => Promise<void> = async () => {},
) {
  const write_file = tool({
    description:
      "Create or update a source file with its complete content. Use a relative project path, e.g. src/App.tsx.",
    inputSchema: z.object({
      path: z.string().min(1),
      content: z.string().max(2_000_000),
    }),
    execute: async ({ path, content }) => {
      try {
        const fullPath = await safeSandboxPath(sandbox, path);
        path = projectPath(path).slice(BASE_PATH.length + 1);
        if (path.endsWith("index.css") && !content.includes("@theme inline"))
          throw new Error(
            "Keep the @theme inline block in index.css; read the existing file and preserve it",
          );
        await sandbox.files.write(fullPath, content);
        await onWrite(path, content);
        return { success: true, path, action: "update" as const };
      } catch (error) {
        return {
          success: false,
          path,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
  const read_file = tool({
    description: "Read current source-file contents before modifying a file.",
    inputSchema: z.object({ path: z.string().min(1) }),
    execute: async ({ path }) => {
      try {
        return {
          success: true,
          content: await sandbox.files.read(
            await safeSandboxPath(sandbox, path),
          ),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
  const run_command = tool({
    description:
      "Run a shell command inside the isolated project sandbox. Use for installing dependencies or checking the generated app. Never start another dev server.",
    inputSchema: z.object({ command: z.string().min(1).max(8000) }),
    execute: async ({ command }) => {
      try {
        const result = await runSandboxCommand(
          sandbox,
          `cd ${shellQuote(BASE_PATH)} && ${command}`,
          60000,
        );
        return {
          success: result.exitCode === 0,
          stdout: result.stdout.slice(-12000),
          stderr: result.stderr.slice(-12000),
          exitCode: result.exitCode,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
  const list_files = tool({
    description:
      "List project source and configuration files. Call this first to understand the structure.",
    inputSchema: z.object({ directory: z.string().default(".") }),
    execute: async ({ directory }) => {
      try {
        const prefix =
          directory === "."
            ? ""
            : projectPath(directory).slice(BASE_PATH.length + 1) + "/";
        return {
          success: true,
          files: (await listSourceFiles(sandbox)).filter((path) =>
            path.startsWith(prefix),
          ),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
  return { write_file, read_file, run_command, list_files };
}
