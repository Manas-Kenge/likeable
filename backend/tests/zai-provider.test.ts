import { expect, test } from "bun:test";
import { createZai } from "@ai-sdk/zai";
import { createChatEngine } from "../src/graph";
import { sandboxFixture } from "./sandbox-fixture";

test("official ZAI transport executes streamed writes, checkpoints source and sends tool results back", async () => {
  type ProviderRequest = {
    stream?: boolean;
    tool_choice?: string;
    tools?: Array<{ function: { name: string } }>;
    messages: Array<Record<string, unknown>>;
  };
  const requests: ProviderRequest[] = [];
  const model = createZai({
    apiKey: "fixture-key",
    fetch: Object.assign(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as ProviderRequest;
        requests.push(body);
        if (!body.stream)
          return Response.json({
            id: "plan",
            model: "glm-4.7",
            created: 1,
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: '["Update the app"]' },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          });
        const writing = requests.length === 2;
        const deltas = writing
          ? [
              { role: "assistant", content: "I’ll update the file. " },
              {
                tool_calls: [
                  {
                    index: 0,
                    id: "write-1",
                    type: "function",
                    function: {
                      name: "write_file",
                      arguments: JSON.stringify({
                        path: "./src/App.tsx",
                        content:
                          "export default function App() { return <h1>Hello</h1>; }",
                      }),
                    },
                  },
                ],
              },
            ]
          : [{ role: "assistant", content: "Updated the app." }];
        const chunks = [
          ...deltas.map((delta) => ({ delta, finish_reason: null })),
          { delta: {}, finish_reason: writing ? "tool_calls" : "stop" },
        ];
        const data =
          chunks
            .map(
              (choice) =>
                `data: ${JSON.stringify({ id: "chat", model: "glm-4.7", created: 1, choices: [{ index: 0, ...choice }] })}\n\n`,
            )
            .join("") + "data: [DONE]\n\n";
        return new Response(data, {
          headers: { "content-type": "text/event-stream" },
        });
      },
      { preconnect: fetch.preconnect },
    ),
  })("glm-4.7");
  const fixture = sandboxFixture("app");
  const checkpoints: Array<{ path: string; content: string }> = [];
  const events = [];
  for await (const event of createChatEngine(model)(
    "Update the greeting",
    "p",
    fixture.sandbox,
    [{ role: "user", content: "Keep the greeting simple" }],
    async (path, content) => {
      checkpoints.push({ path, content });
    },
  ))
    events.push(event);
  expect(requests).toHaveLength(3);
  expect(requests[1]?.tool_choice).toBe("auto");
  expect(
    requests[1]?.tools?.some((tool) => tool.function.name === "write_file"),
  ).toBe(true);
  expect(requests[2]?.messages).toContainEqual(
    expect.objectContaining({ role: "tool", tool_call_id: "write-1" }),
  );
  expect(checkpoints).toEqual([
    {
      path: "src/App.tsx",
      content: "export default function App() { return <h1>Hello</h1>; }",
    },
  ]);
  expect(new TextDecoder().decode(fixture.source.get("src/App.tsx"))).toBe(
    checkpoints[0]!.content,
  );
  expect(events).toContainEqual({
    type: "file_complete",
    data: { path: "src/App.tsx", action: "update" },
  });
  expect(events.at(-1)).toEqual({
    type: "done",
    data: { text: "Updated the app." },
  });
});
