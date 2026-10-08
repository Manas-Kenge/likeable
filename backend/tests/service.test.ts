import { expect, test } from "bun:test";
import { unzipSync } from "fflate";
import { ProjectStore } from "../src/store";
import { ProjectService, type ChatEngine } from "../src/project-service";
import { sandboxFixture } from "./sandbox-fixture";
const ready: ChatEngine = async function* () {
  yield { type: "done", data: { text: "Ready" } };
};
function setup(engine = ready) {
  const store = new ProjectStore(":memory:");
  const first = sandboxFixture("first", {
    "src/App.tsx": "original",
    "package.json": "{}",
    "public/icon.png": new Uint8Array([0, 255]),
    ".env.local": "SECRET",
    "node_modules/secret.js": "dependency",
  });
  const second = sandboxFixture("second", {
    "src/App.tsx": "template",
    "src/extra.ts": "template-only",
  });
  let creates = 0;
  const provider = {
    create: async () => (creates++ === 0 ? first.sandbox : second.sandbox),
    connect: async (id: string) => {
      const fixture = id === "first" ? first : second;
      if (!fixture.state.alive) throw new Error("Expired");
      return fixture.sandbox;
    },
  };
  return {
    store,
    first,
    second,
    service: new ProjectService(store, provider, engine),
  };
}
test("expired sandbox restores persisted source and removes extra template files", async () => {
  const { store, service, first, second } = setup();
  try {
    const project = await service.createProject({ name: "Example" });
    first.source.set("src/App.tsx", new TextEncoder().encode("changed"));
    await service.exportProject(project.id);
    first.state.alive = false;
    const reopened = await service.resumeProject(project.id);
    expect(reopened.sandboxId).toBe("second");
    expect(new TextDecoder().decode(second.source.get("src/App.tsx"))).toBe(
      "changed",
    );
    expect(second.source.has("src/extra.ts")).toBe(false);
    expect(second.source.get("public/icon.png")).toEqual(
      new Uint8Array([0, 255]),
    );
  } finally {
    store.close();
  }
});
test("failed generation persists partial changes and never emits done", async () => {
  const engine: ChatEngine = async function* (
    _message,
    _id,
    sandbox,
    _history,
    onWrite,
  ) {
    await sandbox.files.write("/home/user/app/src/App.tsx", "partial");
    await onWrite("src/App.tsx", "partial");
    yield {
      type: "file_complete",
      data: { path: "src/App.tsx", action: "update" },
    };
    yield { type: "error", data: { message: "Build failed" } };
  };
  const { store, service, first } = setup(engine);
  try {
    const project = await service.createProject({ name: "Example" });
    const session = await service.startRun(project.id, "Refine");
    const events = [];
    for await (const event of service.executeRun(session)) events.push(event);
    expect(events.map((event) => event.type)).toEqual([
      "file_complete",
      "error",
    ]);
    expect(store.get(project.id)?.generationStatus).toBe("failed");
    expect(store.get(project.id)?.messages.at(-1)?.content).toBe(
      "Build failed",
    );
    first.state.alive = false;
    expect(await service.readFile(project.id, "src/App.tsx")).toBe("partial");
  } finally {
    store.close();
  }
});
test("ZIP export preserves binary assets and excludes secrets and dependencies", async () => {
  const { store, service } = setup();
  try {
    const project = await service.createProject({ name: "Example" });
    const archive = unzipSync(await service.exportProject(project.id));
    expect(Object.keys(archive).sort()).toEqual([
      "package.json",
      "public/icon.png",
      "src/App.tsx",
    ]);
    expect(archive["public/icon.png"]).toEqual(new Uint8Array([0, 255]));
  } finally {
    store.close();
  }
});
test("a slow status request cannot erase a generation started while it was waiting", async () => {
  const { store, service, first } = setup();
  try {
    const project = await service.createProject({ name: "Example" });
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    let checks = 0;
    first.state.check = async () => {
      if (++checks === 1) await blocked;
      return true;
    };
    const read = service.getProject(project.id);
    await service.startRun(project.id, "Refine");
    unblock();
    await read;
    expect(store.get(project.id)?.generationStatus).toBe("running");
    expect(
      store.get(project.id)?.messages.map((message) => message.content),
    ).toEqual(["Refine", ""]);
    await expect(service.startRun(project.id, "Concurrent")).rejects.toThrow(
      "already running",
    );
  } finally {
    store.close();
  }
});
test("symlink traversal is rejected before source reads", async () => {
  const { store, service, first } = setup();
  try {
    const project = await service.createProject({ name: "Example" });
    first.state.symlink = true;
    await expect(service.readFile(project.id, "src/App.tsx")).rejects.toThrow(
      "outside",
    );
  } finally {
    store.close();
  }
});

test("a superseded sandbox check cannot mark its replacement stopped", async () => {
  const { store, service, first } = setup();
  try {
    const project = await service.createProject({ name: "Example" });
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    let checks = 0;
    first.state.check = async () => {
      if (++checks === 1) await blocked;
      return false;
    };
    const read = service.getProject(project.id);
    const reopened = await service.resumeProject(project.id);
    expect(reopened.sandboxId).toBe("second");
    unblock();
    expect((await read).status).toBe("running");
    expect(store.get(project.id)?.sandboxId).toBe("second");
    expect(
      (await service.startRun(project.id, "Refine")).sandbox.sandboxId,
    ).toBe("second");
  } finally {
    store.close();
  }
});
