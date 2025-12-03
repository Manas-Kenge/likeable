import { z } from "zod";
import { tool } from "@langchain/core/tools";
import type { Sandbox } from "e2b";

// The sandbox will be injected at runtime via closure
let currentSandbox: Sandbox | null = null;

// Base path for the React app in the sandbox
const BASE_PATH = "/home/user/app";

/**
 * Set the current sandbox for tools to use
 * Called before invoking the graph
 */
export function setCurrentSandbox(sandbox: Sandbox | null) {
  currentSandbox = sandbox;
}

/**
 * Get the current sandbox
 */
export function getCurrentSandbox(): Sandbox | null {
  return currentSandbox;
}

/**
 * Helper to get full path in sandbox
 */
function getFullPath(relativePath: string): string {
  // Remove leading ./ or / from relative path
  const cleanPath = relativePath.replace(/^\.?\//, "");
  return `${BASE_PATH}/${cleanPath}`;
}

// ============================================================================
// FILE TOOLS
// ============================================================================

export const createFile = tool(
  async ({ location, content }) => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    try {
      const fullPath = getFullPath(location);

      // Ensure directory exists
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      await currentSandbox.commands.run(`mkdir -p "${dir}"`);

      //   file using sandbox.files.write
      await currentSandbox.files.write(fullPath, content);

      return {
        success: true,
        message: `File created at ${location}`,
        location,
        fullPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        location,
      };
    }
  },
  {
    name: "create_file",
    description: `Create a new file at the specified location with the given content.
      The path should be relative to the project root (e.g., 'src/components/Button.tsx').
      Use this when adding new files to the React project.`,
    schema: z.object({
      location: z
        .string()
        .describe("Relative path to the file (e.g., 'src/components/Button.tsx')"),
      content: z
        .string()
        .describe("The complete content to write to the file"),
    }),
  }
);

export const readFile = tool(
  async ({ location }) => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    try {
      const fullPath = getFullPath(location);
      const content = await currentSandbox.files.read(fullPath);

      return {
        success: true,
        content,
        location,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        location,
      };
    }
  },
  {
    name: "read_file",
    description: `Read the contents of a file from the specified location.
      Use this to view existing file contents before making modifications.`,
    schema: z.object({
      location: z
        .string()
        .describe("Relative path to the file (e.g., 'src/App.tsx')"),
    }),
  }
);

export const updateFile = tool(
  async ({ location, content }) => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    try {
      const fullPath = getFullPath(location);

      // Check if file exists first
      const existsResult = await currentSandbox.commands.run(`test -f "${fullPath}" && echo "exists"`);
      if (!existsResult.stdout.includes("exists")) {
        return {
          success: false,
          error: `File does not exist: ${location}`,
          location,
        };
      }

      // Write new content
      await currentSandbox.files.write(fullPath, content);

      return {
        success: true,
        message: `File updated at ${location}`,
        location,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        location,
      };
    }
  },
  {
    name: "update_file",
    description: `Update an existing file with new content.
      This tool replaces the entire content of the file.
      Use this when modifying existing files in the project.`,
    schema: z.object({
      location: z
        .string()
        .describe("Relative path to the file (e.g., 'src/components/Header.tsx')"),
      content: z
        .string()
        .describe("The new complete content for the file"),
    }),
  }
);

export const deleteFile = tool(
  async ({ location }) => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    try {
      const fullPath = getFullPath(location);
      await currentSandbox.commands.run(`rm -f "${fullPath}"`);

      return {
        success: true,
        message: `File deleted at ${location}`,
        location,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        location,
      };
    }
  },
  {
    name: "delete_file",
    description: `Delete a file from the specified location.
      Use this to remove files from the project. Be cautious with this operation.`,
    schema: z.object({
      location: z
        .string()
        .describe("Relative path to the file to delete (e.g., 'src/unused/old.tsx')"),
    }),
  }
);

export const searchFiles = tool(
  async ({ query, path = "src" }) => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    try {
      const searchPath = getFullPath(path);
      const result = await currentSandbox.commands.run(
        `find "${searchPath}" -type f -name "*${query}*" 2>/dev/null | head -20`
      );

      const files = result.stdout
        .split("\n")
        .filter(Boolean)
        .map(f => f.replace(`${BASE_PATH}/`, "")); // Convert to relative paths

      return {
        success: true,
        files,
        query,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        files: [],
      };
    }
  },
  {
    name: "search_files",
    description: `Search for files in the project by name pattern.
      Use this to find files when you don't know the exact path.`,
    schema: z.object({
      query: z
        .string()
        .describe("Search pattern (e.g., 'Button' or '.tsx')"),
      path: z
        .string()
        .optional()
        .default("src")
        .describe("Directory to search in (defaults to 'src')"),
    }),
  }
);

export const listDirectory = tool(
  async ({ path = "." }) => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    try {
      const fullPath = getFullPath(path);
      const result = await currentSandbox.commands.run(
        `ls -la "${fullPath}" 2>/dev/null`
      );

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Directory not found: ${path}`,
          path,
        };
      }

      // Parse ls output
      const lines = result.stdout.split("\n").filter(Boolean).slice(1); // Skip "total" line
      const items = lines.map(line => {
        const parts = line.split(/\s+/);
        const isDir = line.startsWith("d");
        const name = parts.slice(8).join(" ");
        return { name, isDirectory: isDir };
      }).filter(item => item.name && item.name !== "." && item.name !== "..");

      return {
        success: true,
        path,
        items,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        path,
        items: [],
      };
    }
  },
  {
    name: "list_directory",
    description: `List all files and directories in the specified directory.
      Use this to explore the project structure.`,
    schema: z.object({
      path: z
        .string()
        .optional()
        .default(".")
        .describe("Relative path to the directory (defaults to project root)"),
    }),
  }
);

export const executeCommand = tool(
  async ({ command, cwd = "." }) => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    try {
      const workDir = getFullPath(cwd);
      const result = await currentSandbox.commands.run(
        `cd "${workDir}" && ${command}`,
        { timeoutMs: 60000 } // 60 second timeout
      );

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stdout: "",
        stderr: "",
      };
    }
  },
  {
    name: "execute_command",
    description: `Run a shell command in the project workspace.
      Useful for npm install, running scripts, etc.
      Commands run in the React project directory by default.`,
    schema: z.object({
      command: z
        .string()
        .describe("Shell command to run (e.g., 'npm install axios')"),
      cwd: z
        .string()
        .optional()
        .default(".")
        .describe("Working directory relative to project root"),
    }),
  }
);

export const writeMultipleFiles = tool(
  async ({ files }) => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    const results: Array<{ path: string; success: boolean; error?: string }> = [];

    for (const file of files) {
      try {
        const fullPath = getFullPath(file.path);

        // Ensure directory exists
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
        await currentSandbox.commands.run(`mkdir -p "${dir}"`);

        // Write file
        await currentSandbox.files.write(fullPath, file.content);

        results.push({ path: file.path, success: true });
      } catch (error) {
        results.push({
          path: file.path,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: results.every(r => r.success),
      results,
      filesWritten: results.filter(r => r.success).length,
      filesFailed: results.filter(r => !r.success).length,
    };
  },
  {
    name: "write_multiple_files",
    description: `Create or overwrite multiple files in a single batch.
      More efficient than calling create_file multiple times.
      Use this when scaffolding components or making bulk changes.`,
    schema: z.object({
      files: z
        .array(
          z.object({
            path: z.string().describe("Relative file path"),
            content: z.string().describe("File content"),
          })
        )
        .describe("Array of files to write"),
    }),
  }
);

// ============================================================================
// CONTEXT/MEMORY TOOLS
// ============================================================================

const MEMORY_FILE = ".lovable_memory.json";

export const getContext = tool(
  async () => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    try {
      const fullPath = getFullPath(MEMORY_FILE);
      const content = await currentSandbox.files.read(fullPath);
      const parsed = JSON.parse(content);

      return { success: true, context: parsed };
    } catch {
      // File doesn't exist yet - return empty context
      return { success: true, context: {} };
    }
  },
  {
    name: "get_context",
    description: `Retrieve the project's stored context/memory.
      Use this to recall previous decisions, patterns, or user preferences.`,
    schema: z.object({}),
  }
);

export const saveContext = tool(
  async ({ context }) => {
    if (!currentSandbox) {
      return { success: false, error: "No sandbox available" };
    }

    try {
      const fullPath = getFullPath(MEMORY_FILE);
      // Parse context if it's a string, otherwise use as-is
      const contextData = typeof context === "string" ? JSON.parse(context) : context;
      await currentSandbox.files.write(fullPath, JSON.stringify(contextData, null, 2));

      return { success: true, message: "Context saved" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
  {
    name: "save_context",
    description: `Save context/memory to the project for future reference.
      Use this to store decisions, patterns, or preferences for continuity.
      Pass the context as a JSON string.`,
    schema: z.object({
      context: z
        .string()
        .describe("Context object as a JSON string to save"),
    }),
  }
);

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const tools = [
  createFile,
  readFile,
  updateFile,
  deleteFile,
  searchFiles,
  listDirectory,
  executeCommand,
  writeMultipleFiles,
  getContext,
  saveContext,
];



