import { expect, test } from "bun:test";
import { ProjectStore } from "../src/store";
import { ProjectService, type ChatEngine } from "../src/project-service";
import { sandboxFixture } from "./sandbox-fixture";
test("generation cannot start while ZIP source collection is in progress", async () => {
  const store = new ProjectStore(":memory:");
  const fixture = sandboxFixture("export", { "src/App.tsx": "source" });
  const engine: ChatEngine = async function* () {
    yield { type: "done", data: { text: "Ready" } };
  };
  const service = new ProjectService(
    store,
    {
      create: async () => fixture.sandbox,
      connect: async () => fixture.sandbox,
    },
    engine,
  );
  try {
    const project = await service.createProject({ name: "Example" });
    const read = fixture.sandbox.files.read.bind(fixture.sandbox.files);
    let unblock!: () => void;
    let collecting!: () => void;
    const started = new Promise<void>((resolve) => {
      collecting = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    fixture.sandbox.files.read = (async (
      path: string,
      options?: { format?: string },
    ) => {
      collecting();
      await blocked;
      return read(path, options as { format: "bytes" });
    }) as typeof fixture.sandbox.files.read;
    const exporting = service.exportProject(project.id);
    await started;
    try {
      await expect(service.startRun(project.id, "Change")).rejects.toThrow(
        "export",
      );
    } finally {
      unblock();
      await exporting;
    }
    expect(store.get(project.id)?.generationStatus).toBe("idle");
  } finally {
    store.close();
  }
});
