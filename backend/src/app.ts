import express from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "./store";
import type { ProjectService } from "./project-service";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(20000).optional(),
  initialPrompt: z.string().trim().min(1).max(20000).optional(),
});
const chatSchema = z.object({
  message: z.string().trim().min(1).max(20000),
  initial: z.boolean().optional(),
});
function projectId(request: Request): string {
  return z.string().uuid().parse(request.params.id);
}
export function createApp(service: ProjectService) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_request, response) =>
    response.json({ status: "ok", timestamp: new Date().toISOString() }),
  );
  app.get("/projects", (_request, response) =>
    response.json({ success: true, data: service.store.list() }),
  );
  app.post("/project", async (request, response) =>
    response
      .status(201)
      .json({
        success: true,
        data: await service.createProject(createSchema.parse(request.body)),
      }),
  );
  app.get("/project/:id", async (request, response) =>
    response.json({
      success: true,
      data: await service.getProject(projectId(request)),
    }),
  );
  app.post("/project/:id/resume", async (request, response) =>
    response.json({
      success: true,
      data: await service.resumeProject(projectId(request)),
    }),
  );
  app.get("/project/:id/files", async (request, response) => {
    const project = await service.getProject(projectId(request));
    response.json({ success: true, data: project.files });
  });
  app.get("/project/:id/file", async (request, response) => {
    const path = z.string().min(1).max(1000).parse(request.query.path);
    const content = await service.readFile(projectId(request), path);
    response.json({ success: true, data: { path, content } });
  });
  app.get("/project/:id/export", async (request, response) => {
    const id = projectId(request);
    const archive = await service.exportProject(id);
    response.setHeader("Content-Type", "application/zip");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="project-${id}.zip"`,
    );
    response.send(Buffer.from(archive));
  });
  app.post("/project/chat/:id", async (request, response) => {
    const body = chatSchema.parse(request.body);
    const session = await service.startRun(
      projectId(request),
      body.message,
      body.initial,
    );
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();
    const write = (data: string) => {
      if (!response.destroyed && !response.writableEnded) response.write(data);
    };
    const heartbeat = setInterval(() => write(": keep-alive\n\n"), 15000);
    try {
      // Continue saving the result after a browser disconnect; reload can recover it.
      for await (const event of service.executeRun(session))
        write(`data: ${JSON.stringify(event)}\n\n`);
      write("data: [DONE]\n\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      service.store.finishRun(session.run.id, "failed", message, []);
      write(
        `data: ${JSON.stringify({ type: "error", data: { message } })}\n\n`,
      );
    } finally {
      clearInterval(heartbeat);
      if (!response.destroyed) response.end();
    }
  });
  app.use((_request, response) =>
    response.status(404).json({ success: false, error: "Not found" }),
  );
  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof z.ZodError || error instanceof SyntaxError
            ? 400
            : typeof error === "object" &&
                error !== null &&
                "status" in error &&
                error.status === 413
              ? 413
              : 500;
      const message =
        error instanceof z.ZodError
          ? error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ")
          : error instanceof Error
            ? error.message
            : "Request failed";
      console.error(`[API] ${status}: ${message}`);
      response.status(status).json({ success: false, error: message });
    },
  );
  return app;
}
