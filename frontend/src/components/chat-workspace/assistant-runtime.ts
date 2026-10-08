import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatMessage } from "./types";
export { getPromptText } from "../../lib/assistant-prompt";

export function convertMessage(message: ChatMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    createdAt: new Date(message.timestamp),
    content: [{ type: "text", text: message.content }],
    ...(message.role === "assistant" && {
      status: message.status === "streaming"
        ? { type: "running" as const }
        : message.status === "error"
          ? { type: "incomplete" as const, reason: "error" as const }
          : { type: "complete" as const, reason: "stop" as const },
    }),
  };
}

export function getRetryPrompt(messages: ChatMessage[], messageId: string): string {
  const index = messages.findIndex((message) => message.id === messageId);
  return (index >= 0 ? messages.slice(0, index).findLast((message) => message.role === "user")?.content : undefined)
    || "Fix the build errors in this project.";
}
