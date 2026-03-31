import { z } from "zod";
import { tool } from "ai";
import type { Sandbox } from "e2b";

const BASE_PATH = "/home/user/app";

export function createFileTools(sandbox: Sandbox) {
  const write_file = tool({
    description: "Create or update a file with complete content. Always write the full file, never partial. Use relative paths like 'src/App.tsx'.",
    inputSchema: z.object({
      path: z.string().describe("Relative file path from project root, e.g. 'src/components/Hero.tsx'"),
      content: z.string().describe("Complete file content to write"),
    }),
    execute: async ({ path, content }) => {
      try {
        const fullPath = `${BASE_PATH}/${path.replace(/^\.?\//, "")}`;
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

        await sandbox.commands.run(`mkdir -p "${dir}"`);
        await sandbox.files.write(fullPath, content);

        // Touch to trigger Vite HMR file watcher
        await sandbox.commands.run(`touch "${fullPath}"`);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Guard: warn if LLM wrote index.css without the required @theme inline block
        if (path.includes("index.css") && !content.includes("@theme inline")) {
          return `⚠ Written: ${path} — WARNING: index.css is missing the @theme inline block. This will break all Tailwind color utilities (bg-background, border-border, etc.). You must include the @theme inline block. Call read_file on the original index.css and restore it.`;
        }

        return `✓ Written: ${path}`;
      } catch (error) {
        return `✗ Error writing ${path}: ${error}`;
      }
    },
  });

  const read_file = tool({
    description: "Read a file's current contents. Always read a file before modifying it.",
    inputSchema: z.object({
      path: z.string().describe("Relative file path, e.g. 'src/App.tsx'"),
    }),
    execute: async ({ path }) => {
      try {
        const fullPath = `${BASE_PATH}/${path.replace(/^\.?\//, "")}`;
        return await sandbox.files.read(fullPath);
      } catch (error) {
        return `✗ Error reading ${path}: ${error}`;
      }
    },
  });

  const run_command = tool({
    description: "Execute a shell command in the project directory (/home/user/app). Use for installing packages or other necessary operations.",
    inputSchema: z.object({
      command: z.string().describe("Shell command to run, e.g. 'npm install framer-motion'"),
    }),
    execute: async ({ command }) => {
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
  });

  const list_files = tool({
    description: "List source files in the project. Call this first to understand the project structure.",
    inputSchema: z.object({
      directory: z.string().optional().default(".").describe("Directory to list, relative to project root"),
    }),
    execute: async ({ directory = "." }) => {
      try {
        const fullPath = `${BASE_PATH}/${directory.replace(/^\.?\//, "")}`;
        const result = await sandbox.commands.run(
          `find ${fullPath} -maxdepth 3 -type f \\( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" -o -name "*.css" -o -name "*.json" \\) | grep -v node_modules | grep -v dist | head -60`
        );
        const files = result.stdout
          .split("\n")
          .filter(Boolean)
          .map(f => f.replace(`${BASE_PATH}/`, ""));
        return `Files:\n${files.join("\n")}`;
      } catch (error) {
        return `✗ Error listing files: ${error}`;
      }
    },
  });

  return { write_file, read_file, run_command, list_files };
}
