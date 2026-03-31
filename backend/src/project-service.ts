import { Sandbox } from "e2b";
import { v4 as uuidv4 } from "uuid";
import type { ModelMessage } from "ai";
import type { Project, CreateProjectRequest } from "./types";

// In-memory storage (replace with database in production)
const projects: Map<string, Project> = new Map();
const sandboxes: Map<string, Sandbox> = new Map();

// E2B template ID - must be set in environment
const E2B_TEMPLATE_ID = process.env.E2B_TEMPLATE_ID || "lovable-clone-dev";

/**
 * Retry configuration for transient errors
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  backoffMultiplier: 2,
  maxDelay: 10000, // 10 seconds
};

/**
 * Retry helper for transient errors (network issues, timeouts)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  operation: string,
  attempts = RETRY_CONFIG.maxAttempts
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on non-transient errors
      if (isNonRetryableError(error)) {
        throw error;
      }

      if (attempt < attempts) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelay *
            Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
          RETRY_CONFIG.maxDelay
        );
        console.log(
          `[Retry ${attempt}/${attempts}] ${operation} failed, retrying in ${delay}ms...`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(
    `[Retry Failed] ${operation} failed after ${attempts} attempts`
  );
  throw lastError;
}

/**
 * Determine if an error is non-retryable (user-fixable or permanent)
 */
function isNonRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const errorMessage = (error as Error).message?.toLowerCase() || "";
  const errorName = (error as Error).name?.toLowerCase() || "";

  // Authentication errors (user-fixable)
  if (
    errorName.includes("auth") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("unauthorized")
  ) {
    return true;
  }

  // Validation errors (user-fixable)
  if (errorName.includes("validation") || errorMessage.includes("invalid")) {
    return true;
  }

  // Not found errors (permanent)
  if (
    errorMessage.includes("not found") ||
    errorMessage.includes("does not exist")
  ) {
    return true;
  }

  return false;
}

/**
 * Create a new project with E2B sandbox (with retry for transient errors)
 */
export async function createProject(
  request: CreateProjectRequest
): Promise<Project> {
  const projectId = uuidv4();
  console.log(`\n========== CREATING PROJECT ==========`);
  console.log(`Project ID: ${projectId}`);
  console.log(`Project Name: ${request.name}`);
  console.log(`Has Initial Prompt: ${!!request.initialPrompt}`);
  console.log(`E2B_TEMPLATE_ID: ${E2B_TEMPLATE_ID}`);

  // Create project record
  const project: Project = {
    id: projectId,
    name: request.name,
    description: request.description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "creating",
    files: [],
    messages: [],
  };

  projects.set(projectId, project);
  console.log(`[${projectId}] Project record created`);

  try {
    console.log(
      `[${projectId}] Creating sandbox from template: ${E2B_TEMPLATE_ID}`
    );
    const startTime = Date.now();

    // Use retry for sandbox creation (transient errors)
    const sandbox = await retryWithBackoff(
      () =>
        Sandbox.create(E2B_TEMPLATE_ID, {
          timeoutMs: 15 * 60 * 1000, // 15 minute lifecycle
        }),
      `Create sandbox for project ${projectId}`
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `[${projectId}] ✅ Sandbox created in ${elapsed}s (ID: ${sandbox.sandboxId})`
    );

    // Store sandbox reference
    sandboxes.set(projectId, sandbox);

    // Get the preview URL - E2B SDK handles this automatically
    const previewUrl = sandbox.getHost(5173);
    console.log(`[${projectId}] Preview URL: https://${previewUrl}`);

    // Start dev server with HMR host configured for E2B proxy
    console.log(`[${projectId}] Starting dev server with HMR host: ${previewUrl}`);
    await sandbox.commands.run(
      `cd /home/user/app && VITE_DEV_SERVER_HMR_HOST=${previewUrl} npm run dev > /tmp/vite.log 2>&1 &`,
      { background: true }
    );
    // Give the dev server a moment to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update project with sandbox info
    project.sandboxId = sandbox.sandboxId;
    project.previewUrl = `https://${previewUrl}`;
    project.status = "running";
    project.updatedAt = new Date().toISOString();

    // Get initial file list with retry
    console.log(`[${projectId}] Fetching initial file list...`);
    const files = await retryWithBackoff(
      () => listSandboxFiles(sandbox),
      `List files for project ${projectId}`
    );
    console.log(`[${projectId}] Found ${files.length} files`);
    project.files = files;

    projects.set(projectId, project);
    console.log(`[${projectId}] ✅ PROJECT READY`);
    console.log(`========== PROJECT CREATION COMPLETE ==========\n`);

    return project;
  } catch (error) {
    console.error(`[${projectId}] ❌ FAILED to create project:`, error);
    project.status = "error";
    project.updatedAt = new Date().toISOString();
    projects.set(projectId, project);
    console.log(`========== PROJECT CREATION FAILED ==========\n`);
    throw error;
  }
}

/**
 * Get a project by ID (with error handling)
 */
export async function getProject(projectId: string): Promise<Project | null> {
  console.log(`[${projectId}] getProject called`);
  const project = projects.get(projectId);
  if (!project) {
    console.log(`[${projectId}] Project not found`);
    return null;
  }
  console.log(`[${projectId}] Project found - status: ${project.status}`);

  // Refresh file list if sandbox is running
  const sandbox = sandboxes.get(projectId);
  if (sandbox && project.status === "running") {
    try {
      console.log(`[${projectId}] Refreshing file list...`);
      // Use retry for file listing (transient errors)
      const files = await retryWithBackoff(
        () => listSandboxFiles(sandbox),
        `Refresh files for project ${projectId}`,
        2 // Fewer retries for refresh
      );
      console.log(`[${projectId}] Refreshed: ${files.length} files`);
      project.files = files;
      project.updatedAt = new Date().toISOString();
      projects.set(projectId, project);
    } catch (error) {
      // Sandbox might have timed out (LLM-recoverable by recreating)
      console.error(
        `[${projectId}] ⚠️ Sandbox error, marking as stopped:`,
        error
      );
      project.status = "stopped";
      projects.set(projectId, project);
    }
  }

  return project;
}

/**
 * Get all projects
 */
export function getAllProjects(): Project[] {
  return Array.from(projects.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Get sandbox for a project
 */
export function getSandbox(projectId: string): Sandbox | undefined {
  return sandboxes.get(projectId);
}

/**
 * Add a user+assistant turn to project history.
 * Enforces rolling 10-turn (20-entry) window.
 */
export function addMessage(
  projectId: string,
  userContent: string,
  assistantContent: string
): void {
  const project = projects.get(projectId);
  if (!project) return;

  project.messages.push({ role: "user", content: userContent });
  project.messages.push({ role: "assistant", content: assistantContent });

  if (project.messages.length > 20) {
    project.messages = project.messages.slice(-20);
  }

  project.updatedAt = new Date().toISOString();
  projects.set(projectId, project);
}

/**
 * Get conversation history for a project (for passing to the LLM).
 */
export function getHistory(projectId: string): ModelMessage[] {
  const project = projects.get(projectId);
  if (!project) return [];
  return project.messages;
}

/**
 * List files in sandbox directory using E2B SDK built-in functionality
 * Simplified to use SDK's files.list() method instead of custom find command
 */
async function listSandboxFiles(sandbox: Sandbox): Promise<string[]> {
  const BASE_PATH = "/home/user/app";
  console.log(`  listSandboxFiles: Searching in ${BASE_PATH}`);

  try {
    // Use E2B SDK's built-in files.list() method recursively
    const allFiles: string[] = [];

    async function listRecursive(path: string, depth = 0): Promise<void> {
      // Limit recursion depth to avoid excessive scanning
      if (depth > 10) return;

      const items = await sandbox.files.list(path);

      for (const item of items) {
        const fullPath = `${path}/${item.name}`;
        const relativePath = fullPath.replace(`${BASE_PATH}/`, "");

        // Skip node_modules and .git directories
        if (
          relativePath.includes("node_modules") ||
          relativePath.includes(".git")
        ) {
          continue;
        }

        if (item.type === "dir") {
          // Recursively list subdirectories
          await listRecursive(fullPath, depth + 1);
        } else if (item.type === "file") {
          // Filter for relevant file extensions
          const ext = item.name.split(".").pop()?.toLowerCase();
          const relevantExtensions = [
            "tsx",
            "ts",
            "js",
            "jsx",
            "mjs",
            "css",
            "json",
            "html",
            "md",
            "toml",
            "yaml",
            "yml",
          ];

          if (ext && relevantExtensions.includes(ext)) {
            allFiles.push(relativePath);
          }
        }
      }
    }

    await listRecursive(BASE_PATH);
    console.log(`  listSandboxFiles: Found ${allFiles.length} files`);
    return allFiles.slice(0, 100); // Limit to 100 files
  } catch (error) {
    console.error("  listSandboxFiles: Failed to list files:", error);
    // Fallback: return empty array instead of throwing
    return [];
  }
}

/**
 * Stop and cleanup a project sandbox
 * Uses E2B SDK's built-in kill() method
 */
export async function stopProject(projectId: string): Promise<void> {
  console.log(`[${projectId}] Stopping project...`);
  const sandbox = sandboxes.get(projectId);

  if (sandbox) {
    try {
      // E2B SDK provides built-in kill() method
      await sandbox.kill();
      console.log(`[${projectId}] Sandbox killed successfully`);
    } catch (error) {
      // Don't throw - just log, as sandbox may already be stopped
      console.warn(
        `[${projectId}] Error killing sandbox (may already be stopped):`,
        error
      );
    }
    sandboxes.delete(projectId);
  }

  const project = projects.get(projectId);
  if (project) {
    project.status = "stopped";
    project.updatedAt = new Date().toISOString();
    projects.set(projectId, project);
    console.log(`[${projectId}] Project marked as stopped`);
  }
}

/**
 * Restart a stopped project (with retry for transient errors)
 */
export async function restartProject(
  projectId: string
): Promise<Project | null> {
  console.log(`[${projectId}] Restarting project...`);
  const project = projects.get(projectId);
  if (!project) {
    console.log(`[${projectId}] Project not found`);
    return null;
  }

  // Stop existing sandbox if any
  await stopProject(projectId);

  // Create new sandbox
  project.status = "creating";
  projects.set(projectId, project);

  try {
    console.log(`[${projectId}] Creating new sandbox...`);

    // Use retry for sandbox creation (transient errors)
    const sandbox = await retryWithBackoff(
      () =>
        Sandbox.create(E2B_TEMPLATE_ID, {
          timeoutMs: 10 * 60 * 1000,
        }),
      `Restart sandbox for project ${projectId}`
    );

    console.log(
      `[${projectId}] ✅ Sandbox restarted (ID: ${sandbox.sandboxId})`
    );

    sandboxes.set(projectId, sandbox);

    // E2B SDK handles host URL automatically
    const previewUrl = sandbox.getHost(5173);
    
    // Start dev server with HMR host configured for E2B proxy
    console.log(`[${projectId}] Starting dev server with HMR host: ${previewUrl}`);
    await sandbox.commands.run(
      `cd /home/user/app && VITE_DEV_SERVER_HMR_HOST=${previewUrl} npm run dev > /tmp/vite.log 2>&1 &`,
      { background: true }
    );
    // Give the dev server a moment to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    project.sandboxId = sandbox.sandboxId;
    project.previewUrl = `https://${previewUrl}`;
    project.status = "running";
    project.updatedAt = new Date().toISOString();

    projects.set(projectId, project);
    console.log(`[${projectId}] Project restarted successfully`);
    return project;
  } catch (error) {
    console.error(`[${projectId}] ❌ Failed to restart project:`, error);
    project.status = "error";
    projects.set(projectId, project);
    throw error;
  }
}
