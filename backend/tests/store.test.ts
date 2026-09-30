import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore } from "../src/store";

test("projects, chat and binary snapshots survive reopening the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "likeable-store-"));
  const path = join(dir, "projects.sqlite");
  let store = new ProjectStore(path);
  try {
    const project = store.create({
      name: "Example",
      initialPrompt: "Build an app",
    });
    const run = store.beginRun(project.id, "Build an app", true);
    store.saveSnapshot(project.id, [
      {
        path: "src/App.tsx",
        content: new TextEncoder().encode("export default () => null"),
      },
      { path: "public/icon.png", content: new Uint8Array([0, 255, 1]) },
    ]);
    store.finishRun(run.id, "completed", "Built", [
      { path: "src/App.tsx", action: "update" },
    ]);
    store.close();
    store = new ProjectStore(path);
    const loaded = store.get(project.id)!;
    expect(loaded.initialRunId).toBe(run.id);
    expect(loaded.messages.map((message) => message.content)).toEqual([
      "Build an app",
      "Built",
    ]);
    expect(loaded.messages[1]?.changes).toEqual([
      { path: "src/App.tsx", action: "update" },
    ]);
    expect(
      store
        .getSnapshot(project.id)
        .find((file) => file.path === "public/icon.png")?.content,
    ).toEqual(new Uint8Array([0, 255, 1]));
    expect(store.list().map((item) => item.id)).toEqual([project.id]);
  } finally {
    store.close();
    rmSync(dir, { recursive: true });
  }
});
test("concurrent runs and duplicate initial prompts are rejected", () => {
  const store = new ProjectStore(":memory:");
  try {
    const project = store.create({ name: "Example", initialPrompt: "Build" });
    const run = store.beginRun(project.id, "Build", true);
    expect(() => store.beginRun(project.id, "Again")).toThrow(
      "already running",
    );
    store.finishRun(run.id, "completed", "Ready", []);
    expect(() => store.beginRun(project.id, "Build", true)).toThrow(
      "already processed",
    );
    expect(store.get(project.id)?.messages.length).toBe(2);
  } finally {
    store.close();
  }
});
test("an interrupted generation becomes failed after restart and retains partial source", () => {
  const dir = mkdtempSync(join(tmpdir(), "likeable-restart-"));
  const path = join(dir, "projects.sqlite");
  let store = new ProjectStore(path);
  try {
    const project = store.create({ name: "Example" });
    store.beginRun(project.id, "Change the header");
    store.saveSnapshot(project.id, [
      { path: "src/App.tsx", content: new TextEncoder().encode("partial") },
    ]);
    store.close();
    store = new ProjectStore(path);
    expect(store.get(project.id)?.generationStatus).toBe("failed");
    expect(store.get(project.id)?.messages.at(-1)?.status).toBe("error");
    expect(
      new TextDecoder().decode(store.getSnapshot(project.id)[0]?.content),
    ).toBe("partial");
  } finally {
    store.close();
    rmSync(dir, { recursive: true });
  }
});
test("snapshot replacement removes deleted files and stored history is not truncated", () => {
  const store = new ProjectStore(":memory:");
  try {
    const project = store.create({ name: "Example" });
    store.saveSnapshot(project.id, [
      { path: "old.ts", content: new Uint8Array([1]) },
    ]);
    store.saveSnapshot(project.id, [
      { path: "new.ts", content: new Uint8Array([2]) },
    ]);
    for (let index = 0; index < 12; index++) {
      const run = store.beginRun(project.id, `Prompt ${index}`);
      store.finishRun(run.id, "completed", `Reply ${index}`, []);
    }
    expect(store.getSnapshot(project.id).map((file) => file.path)).toEqual([
      "new.ts",
    ]);
    expect(store.get(project.id)?.messages.length).toBe(24);
  } finally {
    store.close();
  }
});
