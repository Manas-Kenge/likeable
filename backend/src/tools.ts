import { z } from "zod";
import { tool } from "@langchain/core/tools";
import type { Sandbox } from "e2b";

const BASE_PATH = "/home/user/app";

/**
 * Core file operation - handles both create and update
 */
export function createFileTools(sandbox: Sandbox) {
  const writeFile = tool(
    async ({ path, content }) => {
      try {
        const fullPath = `${BASE_PATH}/${path.replace(/^\.?\//, "")}`;

        // Ensure directory exists
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
        await sandbox.commands.run(`mkdir -p "${dir}"`);

        await sandbox.files.write(fullPath, content);
        return `✓ Written: ${path}`;
      } catch (error) {
        return `✗ Error writing ${path}: ${error}`;
      }
    },
    {
      name: "write_file",
      description: "Create or update a file with content. Use relative paths like 'src/App.tsx'",
      schema: z.object({
        path: z.string().describe("Relative file path"),
        content: z.string().describe("Complete file content"),
      }),
    }
  );

  const readFile = tool(
    async ({ path }) => {
      try {
        const fullPath = `${BASE_PATH}/${path.replace(/^\.?\//, "")}`;
        const content = await sandbox.files.read(fullPath);
        return content;
      } catch (error) {
        return `✗ Error reading ${path}: ${error}`;
      }
    },
    {
      name: "read_file",
      description: "Read a file's contents",
      schema: z.object({
        path: z.string().describe("Relative file path"),
      }),
    }
  );

  const runCommand = tool(
    async ({ command }) => {
      try {
        const result = await sandbox.commands.run(`cd ${BASE_PATH} && ${command}`, {
          timeoutMs: 60000,
        });

        if (result.exitCode === 0) {
          return `✓ ${command}\n${result.stdout}`;
        } else {
          return `✗ Exit ${result.exitCode}\n${result.stderr}`;
        }
      } catch (error) {
        return `✗ Command failed: ${error}`;
      }
    },
    {
      name: "run_command",
      description: "Execute a shell command in the project directory",
      schema: z.object({
        command: z.string().describe("Shell command to run"),
      }),
    }
  );

  const listFiles = tool(
    async ({ directory = "." }) => {
      try {
        const fullPath = `${BASE_PATH}/${directory.replace(/^\.?\//, "")}`;
        const result = await sandbox.commands.run(
          `find ${fullPath} -maxdepth 3 -type f -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" -o -name "*.css" | head -50`
        );

        const files = result.stdout
          .split("\n")
          .filter(Boolean)
          .map(f => f.replace(`${BASE_PATH}/`, ""));

        return `Files found:\n${files.join("\n")}`;
      } catch (error) {
        return `✗ Error listing files: ${error}`;
      }
    },
    {
      name: "list_files",
      description: "List project files (useful for initial exploration)",
      schema: z.object({
        directory: z.string().optional().default(".").describe("Directory to list"),
      }),
    }
  );

  return [writeFile, readFile, runCommand, listFiles];
}

// Remove these - you don't need them:
// ❌ createFile (use write_file)
// ❌ updateFile (use write_file)
// ❌ deleteFile (rarely needed, can use run_command)
// ❌ searchFiles (use list_files or run_command with grep)
// ❌ writeMultipleFiles (just call write_file multiple times)
// ❌ getContext/saveContext (use state instead)
// ❌ listDirectory (use list_files)