import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "dotenv";

import {
  createProject,
  getProject,
  getAllProjects,
  getSandbox,
  updateProjectContext,
  updateProjectFiles,
  addMessage,
} from "./src/project-service";
import { chat, streamChat } from "./src/graph";
import type {
  CreateProjectRequest,
  ChatRequest,
  ApiResponse,
  Project,
  ChatResponse,
} from "./src/types";

// Load environment variables
config();

// Validate required environment variables
const requiredEnvVars = ["ANTHROPIC_API_KEY", "E2B_API_KEY"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.error(`Please create a .env file with the following variables:`);
    console.error(`  ANTHROPIC_API_KEY=your_anthropic_api_key`);
    console.error(`  E2B_API_KEY=your_e2b_api_key`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Health check
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /project
 * Create a new project with E2B sandbox
 */
app.post("/project", async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateProjectRequest;

    if (!body.name) {
      res.status(400).json({
        success: false,
        error: "Project name is required",
      } as ApiResponse<null>);
      return;
    }

    console.log(`\n[API] POST /project - Creating project: ${body.name}`);
    console.log(`[API] Has initial prompt: ${!!body.initialPrompt}`);

    const startTime = Date.now();
    const project = await createProject(body);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[API] Project created in ${elapsed}s`);
    console.log(`[API] Returning project:`, {
      id: project.id,
      status: project.status,
      filesCount: project.files.length,
      previewUrl: project.previewUrl,
    });

    // Note: The frontend will call the streaming endpoint to process the initial prompt
    // This ensures proper SSE streaming to the client

    if (body.initialPrompt) {
      addMessage(project.id, {
        id: `msg-${Date.now()}`,
        role: "user",
        content: body.initialPrompt,
        timestamp: new Date().toISOString(),
        status: "complete",
      });
    }

    res.status(201).json({
      success: true,
      data: project,
    } as ApiResponse<Project>);
  } catch (error) {
    console.error("[API] Failed to create project:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create project",
    } as ApiResponse<null>);
  }
});

/**
 * GET /project/:projectId
 * Get a specific project by ID
 */
app.get(
  "/project/:projectId",
  async (req: Request<{ projectId: string }>, res: Response) => {
    try {
      const { projectId } = req.params;
      console.log(`[API] GET /project/${projectId}`);

      const project = await getProject(projectId);

      if (!project) {
        console.log(`[API] Project ${projectId} not found`);
        res.status(404).json({
          success: false,
          error: "Project not found",
        } as ApiResponse<null>);
        return;
      }

      console.log(`[API] Returning project:`, {
        id: project.id,
        status: project.status,
        filesCount: project.files.length,
      });

      res.json({
        success: true,
        data: project,
      } as ApiResponse<Project>);
    } catch (error) {
      console.error("[API] Failed to get project:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project",
      } as ApiResponse<null>);
    }
  }
);

/**
 * GET /projects
 * List all projects
 */
app.get("/projects", (_req: Request, res: Response) => {
  try {
    const projects = getAllProjects();
    res.json({
      success: true,
      data: projects,
    } as ApiResponse<Project[]>);
  } catch (error) {
    console.error("Failed to list projects:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list projects",
    } as ApiResponse<null>);
  }
});

/**
 * POST /project/chat/:projectId
 * Send a message to the AI agent for a project
 */
app.post(
  "/project/chat/:projectId",
  async (req: Request<{ projectId: string }>, res: Response) => {
    try {
      const { projectId } = req.params;
      const body = req.body as ChatRequest;

      if (!body.message) {
        res.status(400).json({
          success: false,
          error: "Message is required",
        } as ApiResponse<null>);
        return;
      }

      const project = await getProject(projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          error: "Project not found",
        } as ApiResponse<null>);
        return;
      }

      // Check if sandbox is running
      if (project.status !== "running") {
        res.status(400).json({
          success: false,
          error: `Project is ${project.status}. Please restart the project first.`,
        } as ApiResponse<null>);
        return;
      }

      // Get the sandbox
      const sandbox = getSandbox(projectId);
      if (!sandbox) {
        res.status(500).json({
          success: false,
          error: "Sandbox not available for this project",
        } as ApiResponse<null>);
        return;
      }

      // Determine if this is the first message
      const isFirstMessage = !project.context.hasReceivedMessage;

      // Handle streaming if requested
      if (body.stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        try {
          for await (const event of streamChat(
            body.message,
            projectId,
            isFirstMessage,
            sandbox
          )) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
          res.write(`data: [DONE]\n\n`);

          // Update project context after streaming completes
          updateProjectContext(projectId, {
            hasReceivedMessage: true,
            lastMessageAt: new Date().toISOString(),
          });

          res.end();
        } catch (streamError) {
          res.write(
            `data: ${JSON.stringify({ error: String(streamError) })}\n\n`
          );
          res.end();
        }
        return;
      }

      // Non-streaming response
      console.log(
        `Chat message for project ${projectId}: ${body.message.slice(0, 50)}...`
      );
      const result = await chat(body.message, projectId, isFirstMessage, sandbox);

      // Update project context
      updateProjectContext(projectId, {
        hasReceivedMessage: true,
        lastMessageAt: new Date().toISOString(),
      });

      // Update project files from changed files
      if (result.changedFiles && result.changedFiles.length > 0) {
        const filePaths = result.changedFiles.map(
          (f: { path: string }) => f.path
        );
        updateProjectFiles(projectId, filePaths);
      }

      // Get the final message from the last AI message
      const lastMessage = result.messages[result.messages.length - 1];
      const finalMessage =
        lastMessage && typeof lastMessage.content === "string"
          ? lastMessage.content
          : "Implementation complete!";

      const response: ChatResponse = {
        message: finalMessage,
        changes: result.changedFiles || [],
        previewUrl: project.previewUrl,
        status: "success",
      };

      res.json({
        success: true,
        data: response,
      } as ApiResponse<ChatResponse>);
    } catch (error) {
      console.error("Chat failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Chat failed",
      } as ApiResponse<null>);
    }
  }
);

/**
 * GET /project/:projectId/files
 * Get list of files in project
 */
app.get(
  "/project/:projectId/files",
  async (req: Request<{ projectId: string }>, res: Response) => {
    try {
      const { projectId } = req.params;
      console.log(`[API] GET /project/${projectId}/files`);

      const project = await getProject(projectId);

      if (!project) {
        console.log(`[API] Project ${projectId} not found for files request`);
        res.status(404).json({
          success: false,
          error: "Project not found",
        } as ApiResponse<null>);
        return;
      }

      console.log(
        `[API] Returning ${project.files.length} files for project ${projectId}`
      );

      res.json({
        success: true,
        data: project.files,
      } as ApiResponse<string[]>);
    } catch (error) {
      console.error("Failed to get files:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get files",
      } as ApiResponse<null>);
    }
  }
);

/**
 * GET /project/:projectId/file
 * Read a specific file content
 */
app.get(
  "/project/:projectId/file",
  async (req: Request<{ projectId: string }>, res: Response) => {
    try {
      const { projectId } = req.params;
      const { path } = req.query;

      if (!path || typeof path !== "string") {
        res.status(400).json({
          success: false,
          error: "File path is required",
        } as ApiResponse<null>);
        return;
      }

      const sandbox = getSandbox(projectId);
      if (!sandbox) {
        res.status(404).json({
          success: false,
          error: "Project sandbox not found or not running",
        } as ApiResponse<null>);
        return;
      }

      // Use sandbox.files.read() for proper file reading
      // Convert relative path to absolute path in sandbox
      const fullPath = path.startsWith("/") ? path : `/home/user/app/${path}`;
      console.log(`[API] Reading file: ${fullPath}`);
      try {
        const content = await sandbox.files.read(fullPath);
        res.json({
          success: true,
          data: {
            path,
            content,
          },
        } as ApiResponse<{ path: string; content: string }>);
      } catch {
        res.status(404).json({
          success: false,
          error: "File not found",
        } as ApiResponse<null>);
      }
    } catch (error) {
      console.error("Failed to read file:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to read file",
      } as ApiResponse<null>);
    }
  }
);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Not found",
  } as ApiResponse<null>);
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  } as ApiResponse<null>);
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Lovable Backend running on http://localhost:${PORT}`);
  console.log(`
Available endpoints:
  POST   /project              - Create new project
  GET    /project/:id          - Get project details
  GET    /projects             - List all projects
  POST   /project/chat/:id     - Send message to AI
  POST   /project/chat/:id/resume - Resume after interrupt
  GET    /project/:id/files    - List project files
  GET    /project/:id/file     - Read file content
  `);
});

export default app;
