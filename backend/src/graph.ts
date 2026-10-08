import { createZai } from "@ai-sdk/zai";
import { streamText, generateText, isStepCount } from "ai";
import type { LanguageModel, ModelMessage } from "ai";
import type { Sandbox } from "e2b";
import type { StreamEvent } from "../../shared/types";
import { createFileTools } from "./tools";
import { prompt, planningPrompt } from "./prompt";
import { BASE_PATH, shellQuote } from "./paths";
import { waitForPreview } from "./sandbox-files";
import { runSandboxCommand } from "./commands";

export function createChatEngine(model: LanguageModel) {
  return async function* (
    message: string,
    _projectId: string,
    sandbox: Sandbox,
    history: ModelMessage[],
    onWrite: (path: string, content: string) => Promise<void>,
  ): AsyncGenerator<StreamEvent> {
    yield { type: "thinking", data: { message: "Understanding your request" } };
    let steps = ["Read the project and implement the requested changes"];
    try {
      const plan = await generateText({
        model,
        instructions: planningPrompt,
        messages: [...history, { role: "user", content: message }],
        abortSignal: AbortSignal.timeout(60000),
      });
      const parsed: unknown = JSON.parse(plan.text);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((item) => typeof item === "string")
      )
        steps = parsed.slice(0, 8);
    } catch {
      /* Execution can proceed when planning output is unavailable. */
    }
    yield { type: "plan", data: steps };
    try {
      const result = streamText({
        model,
        instructions: prompt,
        messages: [
          ...history,
          {
            role: "user",
            content: `${message}\n\nImplementation plan:\n${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`,
          },
        ],
        tools: createFileTools(sandbox, onWrite),
        stopWhen: isStepCount(20),
        toolChoice: "auto",
        abortSignal: AbortSignal.timeout(8 * 60 * 1000),
      });
      const failedWrites = new Map<string, string>();
      let text = "";
      for await (const part of result.stream) {
        if (part.type === "tool-call") {
          const input = part.input as { path?: string };
          if (part.toolName === "write_file")
            yield {
              type: "file_start",
              data: { path: input.path || "unknown" },
            };
          else
            yield {
              type: "step",
              data: { toolName: part.toolName, path: input.path },
            };
        } else if (
          part.type === "tool-result" &&
          part.toolName === "write_file"
        ) {
          const output = part.output as {
            success: boolean;
            path: string;
            error?: string;
          };
          if (output.success) {
            failedWrites.delete(output.path);
            yield {
              type: "file_complete",
              data: { path: output.path, action: "update" },
            };
          } else
            failedWrites.set(output.path, output.error || "File write failed");
        } else if (part.type === "text-delta") {
          text += part.text;
          yield { type: "message", data: { text } };
        } else if (part.type === "error") throw part.error;
        else if (part.type === "tool-error") throw part.error;
      }
      const finishReason = await result.finishReason;
      if (finishReason !== "stop")
        throw new Error(
          `Generation is incomplete (${finishReason}). Changes have been kept; retry with a smaller request to continue.`,
        );
      if (failedWrites.size)
        throw new Error(
          [...failedWrites]
            .map(([path, error]) => `${path}: ${error}`)
            .join("\n"),
        );
      yield {
        type: "validating",
        data: { message: "Checking the generated app builds" },
      };
      const build = await runSandboxCommand(
        sandbox,
        `cd ${shellQuote(BASE_PATH)} && npm run build`,
        120000,
      );
      if (build.exitCode !== 0)
        throw new Error(
          `Build validation failed. Changes have been kept so you can retry.\n\n${`${build.stdout}\n${build.stderr}`.slice(-8000)}`,
        );
      await waitForPreview(sandbox);
      yield { type: "preview_ready", data: {} };
      yield {
        type: "done",
        data: {
          text:
            (await result.finalStep).text.trim() ||
            "Your changes are ready. The app builds successfully; review the preview and changed files.",
        },
      };
    } catch (error) {
      yield {
        type: "error",
        data: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  };
}

export function streamChat(
  message: string,
  projectId: string,
  sandbox: Sandbox,
  history: ModelMessage[],
  onWrite: (path: string, content: string) => Promise<void>,
) {
  const model = createZai({
    apiKey: process.env.ZAI_API_KEY ?? "",
    baseURL: process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4",
  })(process.env.ZAI_MODEL || "glm-4.7");
  return createChatEngine(model)(message, projectId, sandbox, history, onWrite);
}
