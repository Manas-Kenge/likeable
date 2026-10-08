import { afterEach, expect, test } from "bun:test";
import { ApiClient } from "../../frontend/src/lib/api";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
function respond(chunks: string[]) {
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks)
            controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    )) as unknown as typeof fetch;
}
test("stream buffers an event split across network chunks", async () => {
  respond([
    'data: {"type":"done","data":{"te',
    'xt":"Built"}}\n\n',
    "data: [DONE]\n\n",
  ]);
  const events = [];
  for await (const event of new ApiClient().streamMessage("p", "build"))
    events.push(event);
  expect(events).toEqual([{ type: "done", data: { text: "Built" } }]);
});
test("stream rejects disconnection without a terminal event", async () => {
  respond(['data: {"type":"thinking","data":{"message":"Working"}}\n\n']);
  await expect(
    (async () => {
      for await (const event of new ApiClient().streamMessage("p", "build"))
        void event;
    })(),
  ).rejects.toThrow("interrupted");
});
test("stream accepts CRLF framing and multiple events in a chunk", async () => {
  respond([
    'data: {"type":"thinking","data":{"message":"Working"}}\r\n\r\ndata: {"type":"done","data":{"text":"Ready"}}\r\n\r\ndata: [DONE]\r\n\r\n',
  ]);
  const events = [];
  for await (const event of new ApiClient().streamMessage("p", "build"))
    events.push(event);
  expect(events).toEqual([
    { type: "thinking", data: { message: "Working" } },
    { type: "done", data: { text: "Ready" } },
  ]);
});
test("stream retains an explicit failure rather than synthesizing success", async () => {
  respond([
    'data: {"type":"error","data":{"message":"Build failed"}}\n\ndata: [DONE]\n\n',
  ]);
  const events = [];
  for await (const event of new ApiClient().streamMessage("p", "build"))
    events.push(event);
  expect(events).toEqual([
    { type: "error", data: { message: "Build failed" } },
  ]);
});
