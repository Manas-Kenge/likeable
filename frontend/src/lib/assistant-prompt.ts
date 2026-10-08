import type { AppendMessage } from "@assistant-ui/react";

export function getPromptText(content: AppendMessage["content"]): string {
  return content.map((part) => {
    if (part.type !== "text") throw new Error("Only text requests are supported.");
    return part.text;
  }).join("").trim();
}
