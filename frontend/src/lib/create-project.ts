import { MessageNotSentError, type AppendMessage } from "@assistant-ui/react";
import type { ApiClient } from "./api";
import { getPromptText } from "./assistant-prompt";

export async function createProjectFromPrompt(
  content: AppendMessage["content"],
  create: ApiClient["createProject"],
): Promise<string> {
  try {
    const text = getPromptText(content);
    if (!text) throw new Error("Describe the app you want to build.");
    const result = await create({
      name: text.slice(0, 50),
      description: text,
      initialPrompt: text,
    });
    if (!result.success || !result.data?.id) {
      throw new Error(result.error || "Project could not be created. Your prompt is still here; try again.");
    }
    return result.data.id;
  } catch (cause) {
    // No chat message was delivered: let assistant-ui return the submitted draft.
    throw new MessageNotSentError(cause instanceof Error ? cause.message : "Project could not be created. Try again.");
  }
}
