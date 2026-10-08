import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  CreateProjectRequest,
  FileChange,
  GenerationRun,
  Project,
} from "../../shared/types";
import { projectPath } from "./paths";
export interface SnapshotFile {
  path: string;
  content: Uint8Array;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ProjectStore {
  private db: Database;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshots (project_id TEXT NOT NULL REFERENCES projects(id), path TEXT NOT NULL, content BLOB NOT NULL, PRIMARY KEY(project_id, path));`);
    // Process-local generation cannot survive a backend restart. Saved source does.
    this.db.transaction(() => {
      const running = this.db.query("SELECT data FROM runs").all() as {
        data: string;
      }[];
      for (const row of running) {
        const run = JSON.parse(row.data) as GenerationRun;
        if (run.status === "running")
          this.finishRun(
            run.id,
            "failed",
            "Generation was interrupted by a backend restart. Saved changes are available; retry your request.",
            [],
          );
      }
      for (const project of this.list()) {
        project.status = "stopped";
        this.save(project);
      }
    })();
  }
  close() {
    this.db.close();
  }
  create(request: CreateProjectRequest): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name: request.name,
      description: request.description,
      initialPrompt: request.initialPrompt,
      createdAt: now,
      updatedAt: now,
      status: "creating",
      generationStatus: "idle",
      files: [],
      messages: [],
    };
    this.save(project);
    return project;
  }
  get(id: string): Project | null {
    const row = this.db
      .query("SELECT data FROM projects WHERE id = ?")
      .get(id) as { data: string } | null;
    return row ? (JSON.parse(row.data) as Project) : null;
  }
  list(): Project[] {
    return (
      this.db.query("SELECT data FROM projects").all() as { data: string }[]
    )
      .map((row) => JSON.parse(row.data) as Project)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  save(project: Project) {
    this.db
      .query(
        "INSERT INTO projects(id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
      )
      .run(project.id, JSON.stringify(project));
  }
  beginRun(projectId: string, prompt: string, initial = false): GenerationRun {
    return this.db.transaction(() => {
      const project = this.get(projectId);
      if (!project) throw new HttpError(404, "Project not found");
      if (project.generationStatus === "running")
        throw new HttpError(
          409,
          "A generation is already running for this project",
        );
      if (initial && project.initialRunId)
        throw new HttpError(409, "Initial prompt was already processed");
      const run: GenerationRun = {
        id: randomUUID(),
        projectId,
        prompt,
        status: "running",
        startedAt: new Date().toISOString(),
      };
      project.generationStatus = "running";
      project.updatedAt = run.startedAt;
      if (initial) project.initialRunId = run.id;
      project.messages.push(
        {
          id: randomUUID(),
          role: "user",
          content: prompt,
          timestamp: run.startedAt,
          status: "complete",
          runId: run.id,
          changes: [],
        },
        {
          id: randomUUID(),
          role: "assistant",
          content: "",
          timestamp: run.startedAt,
          status: "streaming",
          runId: run.id,
          changes: [],
        },
      );
      this.save(project);
      this.db
        .query("INSERT INTO runs(id, project_id, data) VALUES (?, ?, ?)")
        .run(run.id, projectId, JSON.stringify(run));
      return run;
    })();
  }
  finishRun(
    runId: string,
    status: "completed" | "failed",
    text: string,
    changes: FileChange[],
  ) {
    this.db.transaction(() => {
      const row = this.db
        .query("SELECT data FROM runs WHERE id = ?")
        .get(runId) as { data: string } | null;
      if (!row) throw new Error("Generation run not found");
      const run = JSON.parse(row.data) as GenerationRun;
      const project = this.get(run.projectId)!;
      run.status = status;
      run.endedAt = new Date().toISOString();
      if (status === "failed") run.error = text;
      project.generationStatus = status;
      project.updatedAt = run.endedAt;
      const assistant = project.messages.find(
        (message) => message.runId === runId && message.role === "assistant",
      );
      if (assistant) {
        assistant.status = status === "completed" ? "complete" : "error";
        assistant.content = text;
        assistant.changes = changes.length ? changes : assistant.changes;
      }
      this.save(project);
      this.db
        .query("UPDATE runs SET data = ? WHERE id = ?")
        .run(JSON.stringify(run), runId);
    })();
  }
  recordChanges(runId: string, changes: FileChange[]) {
    const row = this.db
      .query("SELECT project_id FROM runs WHERE id = ?")
      .get(runId) as { project_id: string } | null;
    if (!row) return;
    const project = this.get(row.project_id)!;
    const assistant = project.messages.find(
      (message) => message.runId === runId && message.role === "assistant",
    );
    if (assistant) assistant.changes = changes;
    this.save(project);
  }
  saveSnapshot(projectId: string, files: SnapshotFile[]) {
    for (const file of files) projectPath(file.path);
    this.db.transaction(() => {
      this.db
        .query("DELETE FROM snapshots WHERE project_id = ?")
        .run(projectId);
      const insert = this.db.query(
        "INSERT INTO snapshots(project_id, path, content) VALUES (?, ?, ?)",
      );
      for (const file of files) insert.run(projectId, file.path, file.content);
      const project = this.get(projectId);
      if (project) {
        project.files = files.map((file) => file.path).sort();
        this.save(project);
      }
    })();
  }
  putFile(projectId: string, file: SnapshotFile) {
    projectPath(file.path);
    this.db.transaction(() => {
      this.db
        .query(
          "INSERT INTO snapshots(project_id, path, content) VALUES (?, ?, ?) ON CONFLICT(project_id, path) DO UPDATE SET content = excluded.content",
        )
        .run(projectId, file.path, file.content);
      const project = this.get(projectId)!;
      if (!project.files.includes(file.path))
        project.files = [...project.files, file.path].sort();
      this.save(project);
    })();
  }
  getSnapshot(projectId: string): SnapshotFile[] {
    return this.db
      .query(
        "SELECT path, content FROM snapshots WHERE project_id = ? ORDER BY path",
      )
      .all(projectId) as SnapshotFile[];
  }
}
