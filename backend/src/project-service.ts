import { Sandbox } from "e2b";
import { v4 as uuidv4 } from "uuid";
import type { Project, CreateProjectRequest } from "./types";

// In-memory storage (replace with database in production)
const projects: Map<string, Project> = new Map();
const sandboxes: Map<string, Sandbox> = new Map();

// E2B template ID - must be set in environment
const E2B_TEMPLATE_ID = process.env.E2B_TEMPLATE_ID || "lovable-clone-dev";

/**
 * Create a new project with E2B sandbox
 */
export async function createProject(request: CreateProjectRequest): Promise<Project> {
  const projectId = uuidv4();
  console.log(`\n========== CREATING PROJECT ==========`);
  console.log(`Project ID: ${projectId}`);
  console.log(`Project Name: ${request.name}`);
  console.log(`Has Initial Prompt: ${!!request.initialPrompt}`);
  console.log(`E2B_TEMPLATE_ID: ${E2B_TEMPLATE_ID || '(not set - using dynamic setup)'}`);

  // Create project record with initial prompt in context if provided
  // Note: hasReceivedMessage is false until the frontend processes it via streaming
  const project: Project = {
    id: projectId,
    name: request.name,
    description: request.description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "creating",
    files: [],
    context: request.initialPrompt
      ? { initialPrompt: request.initialPrompt, hasReceivedMessage: false }
      : {},
  };

  projects.set(projectId, project);
  console.log(`[${projectId}] Project record created, status: creating`);

  try {
    console.log(`[${projectId}] Creating sandbox from template: ${E2B_TEMPLATE_ID}`);
    const startTime = Date.now();

    const sandbox = await Sandbox.create(E2B_TEMPLATE_ID, {
      timeoutMs: 10 * 60 * 1000, // 10 minute lifecycle
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${projectId}] ✅ Sandbox created from template in ${elapsed}s`);
    console.log(`[${projectId}] Sandbox ID: ${sandbox.sandboxId}`);

    // Store sandbox reference
    sandboxes.set(projectId, sandbox);
    console.log(`[${projectId}] Sandbox stored in memory`);

    // Get the preview URL (Vite dev server runs on port 5173)
    const previewUrl = sandbox.getHost(5173);
    console.log(`[${projectId}] Preview URL: https://${previewUrl}`);

    // Update project with sandbox info
    project.sandboxId = sandbox.sandboxId;
    project.previewUrl = `https://${previewUrl}`;
    project.status = "running";
    project.updatedAt = new Date().toISOString();

    // Get initial file list
    console.log(`[${projectId}] Fetching initial file list...`);
    const files = await listSandboxFiles(sandbox, "/home/user/app");
    console.log(`[${projectId}] Found ${files.length} files:`, files.slice(0, 5), files.length > 5 ? '...' : '');
    project.files = files;

    projects.set(projectId, project);
    console.log(`[${projectId}] ✅ PROJECT READY - Status: ${project.status}`);
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
 * Get a project by ID
 */
export async function getProject(projectId: string): Promise<Project | null> {
  console.log(`[${projectId}] getProject called`);
  const project = projects.get(projectId);
  if (!project) {
    console.log(`[${projectId}] Project not found in memory`);
    return null;
  }
  console.log(`[${projectId}] Project found - status: ${project.status}, files: ${project.files.length}`);

  // Refresh file list if sandbox is running
  const sandbox = sandboxes.get(projectId);
  console.log(`[${projectId}] Sandbox in memory: ${!!sandbox}`);

  if (sandbox && project.status === "running") {
    try {
      console.log(`[${projectId}] Refreshing file list...`);
      const files = await listSandboxFiles(sandbox, "/home/user/app");
      console.log(`[${projectId}] Refreshed files: ${files.length}`);
      project.files = files;
      project.updatedAt = new Date().toISOString();
      projects.set(projectId, project);
    } catch (e) {
      // Sandbox might have timed out
      console.error(`[${projectId}] ⚠️ Sandbox error, marking as stopped:`, e);
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
 * Update project context
 */
export function updateProjectContext(
  projectId: string,
  context: Record<string, unknown>
): Project | null {
  const project = projects.get(projectId);
  if (!project) return null;

  project.context = { ...project.context, ...context };
  project.updatedAt = new Date().toISOString();
  projects.set(projectId, project);

  return project;
}

/**
 * Update project files list
 */
export function updateProjectFiles(projectId: string, files: string[]): Project | null {
  const project = projects.get(projectId);
  if (!project) return null;

  project.files = [...new Set([...project.files, ...files])];
  project.updatedAt = new Date().toISOString();
  projects.set(projectId, project);

  return project;
}

/**
 * List files in sandbox directory
 */
async function listSandboxFiles(sandbox: Sandbox, path: string): Promise<string[]> {
  console.log(`  listSandboxFiles: Searching in ${path}`);
  try {
    // Find all relevant files, excluding node_modules and .git
    const cmd = `find ${path} -type f \\( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.css" -o -name "*.json" -o -name "*.html" -o -name "*.md" -o -name "*.toml" -o -name "*.yaml" -o -name "*.yml" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null | head -100`;
    console.log(`  listSandboxFiles: Running command: ${cmd}`);
    const result = await sandbox.commands.run(cmd);
    console.log(`  listSandboxFiles: Exit code: ${result.exitCode}`);
    console.log(`  listSandboxFiles: stdout length: ${result.stdout?.length || 0}`);
    if (result.stderr) {
      console.log(`  listSandboxFiles: stderr: ${result.stderr}`);
    }
    if (result.exitCode === 0 && result.stdout) {
      // Convert absolute paths to relative paths (remove /home/user/app/ prefix)
      const files = result.stdout.split("\n").filter(Boolean).map(f => f.replace(/^\/home\/user\/app\//, ''));
      console.log(`  listSandboxFiles: Found ${files.length} files`);
      return files;
    }
  } catch (e) {
    console.error("  listSandboxFiles: Failed to list files:", e);
  }
  console.log(`  listSandboxFiles: Returning empty array`);
  return [];
}

/**
 * Stop and cleanup a project sandbox
 */
export async function stopProject(projectId: string): Promise<void> {
  const sandbox = sandboxes.get(projectId);
  if (sandbox) {
    try {
      await sandbox.kill();
    } catch (e) {
      console.error("Failed to kill sandbox:", e);
    }
    sandboxes.delete(projectId);
  }

  const project = projects.get(projectId);
  if (project) {
    project.status = "stopped";
    project.updatedAt = new Date().toISOString();
    projects.set(projectId, project);
  }
}

/**
 * Restart a stopped project
 */
export async function restartProject(projectId: string): Promise<Project | null> {
  const project = projects.get(projectId);
  if (!project) return null;

  // Stop existing sandbox if any
  await stopProject(projectId);

  // Create new sandbox
  project.status = "creating";
  projects.set(projectId, project);

  try {
    const sandbox = await Sandbox.create(E2B_TEMPLATE_ID, {
      timeoutMs: 10 * 60 * 1000,
    });
    console.log("Sandbox created from template, dev server already running!");

    sandboxes.set(projectId, sandbox);

    const previewUrl = sandbox.getHost(5173);
    project.sandboxId = sandbox.sandboxId;
    project.previewUrl = `https://${previewUrl}`;
    project.status = "running";
    project.updatedAt = new Date().toISOString();

    projects.set(projectId, project);
    return project;
  } catch (error) {
    project.status = "error";
    projects.set(projectId, project);
    throw error;
  }
}
