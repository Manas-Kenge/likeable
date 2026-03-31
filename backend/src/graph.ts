import { createZhipu } from "zhipu-ai-provider";
import { streamText, generateText, stepCountIs } from "ai";
import type { ModelMessage, StreamTextResult } from "ai";
import type { Sandbox } from "e2b";
import { createFileTools } from "./tools";
import { prompt, planningPrompt } from "./prompt";

const zai = createZhipu({
  apiKey: process.env.ZAI_API_KEY ?? "",
  baseURL: "https://api.z.ai/api/paas/v4",
});

const model = zai("glm-4.7");

/** Poll the Vite dev server until it responds with HTTP 200 */
async function waitForDevServer(sandbox: Sandbox, maxAttempts = 10, intervalMs = 500): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await sandbox.commands.run(
        'curl -s -o /dev/null -w "%{http_code}" http://localhost:5173',
        { timeoutMs: 3000 }
      );
      if (result.stdout?.trim() === "200") {
        return true;
      }
    } catch {
      // keep polling
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}

// Streaming chat — yields SSE-style event objects
export async function* streamChat(
  message: string,
  _projectId: string,
  sandbox: Sandbox,
  history: ModelMessage[]
) {
  // Phase 1: Planning
  yield { type: "thinking", data: { message: "Analyzing your request..." } };

  let steps: string[];
  try {
    const planResult = await generateText({
      model,
      system: planningPrompt,
      messages: [{ role: "user", content: message }],
    });
    const parsed = JSON.parse(planResult.text);
    if (!Array.isArray(parsed)) throw new Error("not array");
    steps = parsed;
  } catch {
    steps = ["Implementing your request..."];
  }

  yield { type: "plan", data: steps };

  // Phase 2: Execution
  let hasFileChanges = false;
  const planContext = steps.map((s, i) => `${i + 1}. ${s}`).join("\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result!: StreamTextResult<any, any>;
  try {
    result = streamText({
      model,
      system: prompt,
      messages: [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: `I'll follow this plan:\n${planContext}` },
      ],
      tools: createFileTools(sandbox),
      stopWhen: stepCountIs(20),
      toolChoice: "auto",
    });

    for await (const part of result.fullStream) {
      if (part.type === "tool-call") {
        const toolName = part.toolName;
        const input = part.input as Record<string, unknown>;
        const path = (input.path as string) ?? null;

        if (toolName === "write_file") {
          // file_start/file_complete handle write_file — skip generic step to avoid duplication
          yield { type: "file_start", data: { path } };
        } else {
          // Emit structured step for read_file, run_command, list_files
          yield {
            type: "step",
            data: { toolName, path },
          };
        }
      } else if (part.type === "tool-result") {
        const toolName = part.toolName;
        const input = part.input as Record<string, unknown>;
        if (toolName === "write_file") {
          yield { type: "file_complete", data: { path: input.path, action: "write" } };
          hasFileChanges = true;
        }
      } else if (part.type === "error") {
        console.error(`[StreamChat] error:`, part.error);
        yield { type: "error", data: { message: String(part.error) } };
      }
    }
  } catch (error) {
    console.error(`[StreamChat] Fatal error:`, error);
    yield { type: "error", data: { message: error instanceof Error ? error.message : String(error) } };
  }

  const finalText = await result.text;
  yield { type: "done", data: { text: finalText } };

  if (hasFileChanges) {
    const isReady = await waitForDevServer(sandbox);
    if (isReady) yield { type: "preview_ready" };
  }
}
