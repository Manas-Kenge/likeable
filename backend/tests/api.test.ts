import { expect, test } from "bun:test";
import { once } from "node:events";
import { createApp } from "../src/app";
import { ProjectService, type ChatEngine } from "../src/project-service";
import { ProjectStore } from "../src/store";
import { sandboxFixture } from "./sandbox-fixture";

test("HTTP API validates requests and streams persisted generation results", async () => {
  const store = new ProjectStore(":memory:");
  const fixture = sandboxFixture("api", {
    "src/App.tsx": "source",
    "package.json": "{}",
  });
  const engine: ChatEngine = async function* () {
    yield { type: "done", data: { text: "Built" } };
  };
  const service = new ProjectService(
    store,
    {
      create: async () => fixture.sandbox,
      connect: async () => fixture.sandbox,
    },
    engine,
  );
  const server = createApp(service).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No test server address");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const invalid = await fetch(`${base}/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: " " }),
    });
    expect(invalid.status).toBe(400);
    const created = await fetch(`${base}/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Example", initialPrompt: "Build" }),
    });
    expect(created.status).toBe(201);
    const { data } = (await created.json()) as { data: { id: string } };
    const stream = await fetch(`${base}/project/chat/${data.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Build", initial: true }),
    });
    expect(stream.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await stream.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain("data: [DONE]");
    const project = (await (
      await fetch(`${base}/project/${data.id}`)
    ).json()) as { data: { messages: { content: string }[] } };
    expect(project.data.messages.map((message) => message.content)).toEqual([
      "Build",
      "Built",
    ]);
    const duplicate = await fetch(`${base}/project/chat/${data.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Build", initial: true }),
    });
    expect(duplicate.status).toBe(409);
    const unsafe = await fetch(
      `${base}/project/${data.id}/file?path=${encodeURIComponent("../secret")}`,
    );
    expect(unsafe.status).toBe(400);
    const archive = await fetch(`${base}/project/${data.id}/export`);
    expect(archive.headers.get("Content-Type")).toContain("application/zip");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
  }
});
