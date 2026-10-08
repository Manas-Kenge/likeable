import { expect, test } from "bun:test";
import type { LanguageModel } from "ai";
import { createChatEngine } from "../src/graph";
import { sandboxFixture } from "./sandbox-fixture";
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
function model(
  finishReason: "stop" | "length" | "tool-calls" = "stop",
  toolLoop = false,
  inspectFirst = false,
): LanguageModel {
  let streamCalls = 0;
  return {
    specificationVersion: "v4",
    provider: "fixture",
    modelId: "fixture",
    supportedUrls: {},
    doGenerate: async () => ({
      content: [{ type: "text", text: '["Implement"]' }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }),
    doStream: async () => {
      const inspecting = inspectFirst && streamCalls++ === 0;
      return {
        stream: new ReadableStream({
          start(controller) {
            if (toolLoop || inspecting) {
              if (inspecting) {
                controller.enqueue({ type: "text-start", id: "progress" });
                controller.enqueue({
                  type: "text-delta",
                  id: "progress",
                  delta: "I’ll inspect the files first. ",
                });
                controller.enqueue({ type: "text-end", id: "progress" });
              }
              controller.enqueue({
                type: "tool-call",
                toolCallId: crypto.randomUUID(),
                toolName: "list_files",
                input: '{"directory":"."}',
              });
              controller.enqueue({
                type: "finish",
                finishReason: {
                  unified: inspecting ? "tool-calls" : finishReason,
                  raw: finishReason,
                },
                usage,
              });
              controller.close();
              return;
            }
            controller.enqueue({ type: "text-start", id: "answer" });
            controller.enqueue({
              type: "text-delta",
              id: "answer",
              delta: "Updated the app.",
            });
            controller.enqueue({ type: "text-end", id: "answer" });
            controller.enqueue({
              type: "finish",
              finishReason: {
                unified: inspecting ? "tool-calls" : finishReason,
                raw: finishReason,
              },
              usage,
            });
            controller.close();
          },
        }),
      };
    },
  };
}

test("generation with a failing build emits diagnostics and no success event", async () => {
  const fixture = sandboxFixture("app");
  fixture.state.failBuild = true;
  const events = [];
  for await (const event of createChatEngine(model())(
    "Build",
    "p",
    fixture.sandbox,
    [],
    async () => {},
  ))
    events.push(event);
  expect(events.some((event) => event.type === "done")).toBe(false);
  expect(events.at(-1)).toEqual({
    type: "error",
    data: {
      message:
        "Build validation failed. Changes have been kept so you can retry.\n\n\nTS1005: missing brace",
    },
  });
});
test("success is emitted only after validation and preview readiness", async () => {
  const fixture = sandboxFixture("app");
  const events = [];
  for await (const event of createChatEngine(model())(
    "Build",
    "p",
    fixture.sandbox,
    [],
    async () => {},
  ))
    events.push(event);
  expect(events.map((event) => event.type)).toEqual([
    "thinking",
    "plan",
    "message",
    "validating",
    "preview_ready",
    "done",
  ]);
  expect(events.at(-1)).toEqual({
    type: "done",
    data: { text: "Updated the app." },
  });
});

test("E2B command exceptions retain compiler diagnostics", async () => {
  const fixture = sandboxFixture("app");
  fixture.state.throwBuildError = true;
  const events = [];
  for await (const event of createChatEngine(model())(
    "Build",
    "p",
    fixture.sandbox,
    [],
    async () => {},
  ))
    events.push(event);
  expect(events.at(-1)).toMatchObject({
    type: "error",
    data: { message: expect.stringContaining("TS1005: missing brace") },
  });
  expect(events.some((event) => event.type === "done")).toBe(false);
});

for (const reason of ["length", "tool-calls"] as const) {
  test(`generation ending with ${reason} remains recoverable instead of reporting success`, async () => {
    const fixture = sandboxFixture("app");
    const events = [];
    for await (const event of createChatEngine(model(reason))(
      "Build",
      "p",
      fixture.sandbox,
      [],
      async () => {},
    ))
      events.push(event);
    expect(
      events.some(
        (event) => event.type === "done" || event.type === "validating",
      ),
    ).toBe(false);
    expect(events.at(-1)).toMatchObject({
      type: "error",
      data: { message: expect.stringContaining("incomplete") },
    });
  });
}

test("exhausting twenty tool steps cannot report a completed generation", async () => {
  const fixture = sandboxFixture("app");
  const events = [];
  for await (const event of createChatEngine(model("tool-calls", true))(
    "Build",
    "p",
    fixture.sandbox,
    [],
    async () => {},
  ))
    events.push(event);
  expect(events.filter((event) => event.type === "step")).toHaveLength(20);
  expect(events.some((event) => event.type === "done")).toBe(false);
  expect(events.at(-1)?.type).toBe("error");
});

test("multi-step completion saves the final answer without intermediate tool commentary", async () => {
  const fixture = sandboxFixture("app");
  const events = [];
  for await (const event of createChatEngine(model("stop", false, true))(
    "Build",
    "p",
    fixture.sandbox,
    [],
    async () => {},
  ))
    events.push(event);
  expect(events.some((event) => event.type === "step")).toBe(true);
  expect(events.at(-1)).toEqual({
    type: "done",
    data: { text: "Updated the app." },
  });
});
