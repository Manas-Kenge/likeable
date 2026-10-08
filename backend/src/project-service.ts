import { Sandbox } from "e2b";
import { zipSync } from "fflate";
import type { ModelMessage } from "ai";
import type {
  CreateProjectRequest,
  FileChange,
  GenerationRun,
  Project,
  StreamEvent,
} from "../../shared/types";
import { HttpError, ProjectStore } from "./store";
import { runSandboxCommand } from "./commands";
import { BASE_PATH, projectPath, shellQuote } from "./paths";
import {
  captureFiles,
  listSourceFiles,
  safeSandboxPath,
  waitForPreview,
} from "./sandbox-files";

export interface SandboxProvider {
  create(): Promise<Sandbox>;
  connect(id: string): Promise<Sandbox>;
}
export interface RunSession {
  run: GenerationRun;
  sandbox: Sandbox;
  history: ModelMessage[];
}
export type ChatEngine = (
  message: string,
  projectId: string,
  sandbox: Sandbox,
  history: ModelMessage[],
  onWrite: (path: string, content: string) => Promise<void>,
) => AsyncGenerator<StreamEvent>;
export class ProjectService {
  private sandboxes = new Map<string, Sandbox>();
  private provisioning = new Map<string, Promise<Project>>();
  private exporting = new Set<string>();
  constructor(
    public store: ProjectStore,
    private provider: SandboxProvider,
    private engine: ChatEngine,
  ) {}
  async createProject(request: CreateProjectRequest) {
    const project = this.store.create(request);
    return this.resumeProject(project.id);
  }
  async getProject(id: string): Promise<Project> {
    let project = this.store.get(id);
    if (!project) throw new HttpError(404, "Project not found");
    if (this.provisioning.has(id)) return project;
    if (project.sandboxId) {
      const checkedSandboxId = project.sandboxId;
      try {
        const sandbox =
          this.sandboxes.get(id) ||
          (await this.provider.connect(project.sandboxId));
        if (!(await sandbox.isRunning())) throw new Error("Sandbox expired");
        project = this.store.get(id)!;
        if (project.sandboxId !== checkedSandboxId) return project;
        this.sandboxes.set(id, sandbox);
        project.status = "running";
        project.previewUrl = `https://${sandbox.getHost(5173)}`;
      } catch {
        project = this.store.get(id)!;
        if (project.sandboxId !== checkedSandboxId) return project;
        project.status = "stopped";
        project.previewUrl = undefined;
        this.sandboxes.delete(id);
      }
      this.store.save(project);
    }
    return project;
  }
  async resumeProject(id: string): Promise<Project> {
    const existing = this.provisioning.get(id);
    if (existing) return existing;
    const task = this.provision(id);
    this.provisioning.set(id, task);
    try {
      return await task;
    } finally {
      this.provisioning.delete(id);
    }
  }
  private async provision(id: string): Promise<Project> {
    const project = await this.getProject(id);
    if (this.exporting.has(id))
      throw new HttpError(
        409,
        "Wait for the export to finish before reopening",
      );
    if (project.generationStatus === "running")
      throw new HttpError(409, "A generation is already running");
    if (project.status === "running" && this.sandboxes.has(id)) return project;
    project.status = "creating";
    this.store.save(project);
    let sandbox: Sandbox | undefined;
    try {
      sandbox = await this.provider.create();
      const saved = this.store.getSnapshot(id);
      if (saved.length) {
        const paths = new Set(saved.map((file) => file.path));
        for (const path of await listSourceFiles(sandbox))
          if (!paths.has(path))
            await sandbox.files.remove(await safeSandboxPath(sandbox, path));
        for (const file of saved) {
          await safeSandboxPath(sandbox, file.path);
          await sandbox.files.write(
            projectPath(file.path),
            new Blob([new Uint8Array(file.content)]),
          );
        }
        const install = await runSandboxCommand(
          sandbox,
          `cd ${shellQuote(BASE_PATH)} && npm install --no-audit --no-fund`,
          120000,
        );
        if (install.exitCode !== 0)
          throw new Error(
            `Dependencies could not be restored: ${install.stderr.slice(-4000)}`,
          );
      }
      const host = sandbox.getHost(5173);
      await sandbox.commands.run(
        `cd ${shellQuote(BASE_PATH)} && VITE_DEV_SERVER_HMR_HOST=${shellQuote(host)} npm run dev > /tmp/vite.log 2>&1`,
        { background: true },
      );
      await waitForPreview(sandbox);
      this.store.saveSnapshot(id, await captureFiles(sandbox));
      const ready = this.store.get(id)!;
      ready.sandboxId = sandbox.sandboxId;
      ready.previewUrl = `https://${host}`;
      ready.status = "running";
      ready.updatedAt = new Date().toISOString();
      this.store.save(ready);
      this.sandboxes.set(id, sandbox);
      return ready;
    } catch (error) {
      if (sandbox) await sandbox.kill().catch(() => {});
      const failed = this.store.get(id)!;
      failed.status = "error";
      failed.sandboxId = undefined;
      failed.previewUrl = undefined;
      this.store.save(failed);
      throw error;
    }
  }
  async startRun(
    id: string,
    message: string,
    initial = false,
  ): Promise<RunSession> {
    const project = await this.getProject(id);
    if (this.provisioning.has(id))
      throw new HttpError(409, "Project is being reopened");
    if (this.exporting.has(id))
      throw new HttpError(
        409,
        "Wait for the export to finish before generating",
      );
    const sandbox = this.sandboxes.get(id);
    if (project.status !== "running" || !sandbox)
      throw new HttpError(409, "Reopen the project before sending a message");
    if (
      initial &&
      (!project.initialPrompt || message !== project.initialPrompt)
    )
      throw new HttpError(400, "Initial prompt does not match this project");
    const history: ModelMessage[] = project.messages
      .slice(-20)
      .map((item) => ({ role: item.role, content: item.content }));
    const run = this.store.beginRun(id, message, initial);
    return { run, sandbox, history };
  }
  async *executeRun(session: RunSession): AsyncGenerator<StreamEvent> {
    const { run, sandbox, history } = session;
    let changes: FileChange[] = [];
    let finalText = "";
    let failure: string | undefined;
    let completed = false;
    const checkpoint = async (path: string, content: string) =>
      this.store.putFile(run.projectId, {
        path,
        content: new TextEncoder().encode(content),
      });
    try {
      for await (const event of this.engine(
        run.prompt,
        run.projectId,
        sandbox,
        history,
        checkpoint,
      )) {
        if (event.type === "file_complete") {
          changes = [
            ...changes.filter((change) => change.path !== event.data.path),
            event.data,
          ];
          this.store.recordChanges(run.id, changes);
        }
        if (event.type === "done") {
          finalText = event.data.text;
          completed = true;
        } else if (event.type === "error") {
          failure = event.data.message;
          break;
        } else yield event;
      }
      if (!completed && !failure)
        failure =
          "Generation ended without a completed result. Retry your request.";
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    try {
      this.store.saveSnapshot(run.projectId, await captureFiles(sandbox));
    } catch (error) {
      failure = `${failure ? `${failure}\n\n` : ""}Some source changes could not be saved: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (failure) {
      this.store.finishRun(run.id, "failed", failure, changes);
      yield { type: "error", data: { message: failure } };
    } else {
      this.store.finishRun(run.id, "completed", finalText, changes);
      yield { type: "done", data: { text: finalText, runId: run.id } };
    }
  }
  async readFile(id: string, path: string): Promise<string> {
    try {
      projectPath(path);
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Invalid file path",
      );
    }
    const project = await this.getProject(id);
    const sandbox = this.sandboxes.get(id);
    if (project.status === "running" && sandbox) {
      let fullPath: string;
      try {
        fullPath = await safeSandboxPath(sandbox, path);
      } catch (error) {
        throw new HttpError(
          400,
          error instanceof Error ? error.message : "Invalid file path",
        );
      }
      try {
        return await sandbox.files.read(fullPath);
      } catch {
        throw new HttpError(404, "File not found");
      }
    }
    const file = this.store.getSnapshot(id).find((item) => item.path === path);
    if (!file) throw new HttpError(404, "File not found");
    return new TextDecoder().decode(file.content);
  }
  async exportProject(id: string): Promise<Uint8Array> {
    const project = await this.getProject(id);
    if (project.generationStatus === "running" || this.provisioning.has(id))
      throw new HttpError(
        409,
        "Wait for the current operation before exporting",
      );
    if (this.exporting.has(id))
      throw new HttpError(409, "An export is already running");
    this.exporting.add(id);
    try {
      const sandbox = this.sandboxes.get(id);
      if (project.status === "running" && sandbox)
        this.store.saveSnapshot(id, await captureFiles(sandbox));
      const files = this.store.getSnapshot(id);
      if (!files.length)
        throw new HttpError(409, "No source files have been saved yet");
      return zipSync(
        Object.fromEntries(files.map((file) => [file.path, file.content])),
        { level: 6 },
      );
    } finally {
      this.exporting.delete(id);
    }
  }
}
export function e2bProvider(templateId: string): SandboxProvider {
  return {
    create: () => Sandbox.create(templateId, { timeoutMs: 15 * 60 * 1000 }),
    connect: (id) => Sandbox.connect(id),
  };
}
