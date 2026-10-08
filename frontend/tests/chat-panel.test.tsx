import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatPanel } from "../src/components/chat-workspace/chat-panel";
import type { ChatMessage } from "../src/components/chat-workspace/types";

const messages: ChatMessage[] = [
  { id: "user", role: "user", content: "Build a dashboard", timestamp: "2026-10-08T00:00:00Z", changes: [], status: "complete", runId: "run-1" },
  { id: "assistant", role: "assistant", content: "Built **your app**.", timestamp: "2026-10-08T00:00:01Z", changes: [{ path: "src/App.tsx", action: "update" }], status: "complete", runId: "run-1" },
];

function renderConversation(history: ChatMessage[]) {
  return renderToStaticMarkup(
    <ChatPanel messages={history} generating={history.some((message) => message.status === "streaming")} disabled={false}
      onSendMessage={async () => {}} onRetry={() => {}}
      onSelectPath={() => {}} onShowPreview={() => {}} />,
  );
}

describe("build conversation rendering", () => {
  it("renders saved user text, assistant Markdown, build details, and the composer", () => {
    const html = renderConversation(messages);
    assert.match(html, /Build a dashboard/);
    assert.match(html, /<strong[^>]*>your app<\/strong>/);
    assert.match(html, /Updated 1 file/);
    assert.match(html, /Details/);
    assert.match(html, /Preview/);
    assert.match(html, /Describe a change/);
  });

  it("keeps the failed build visible with an actionable retry", () => {
    const html = renderConversation([messages[0], { ...messages[1], status: "error", content: "Please fix this build." }]);
    assert.match(html, /Build needs attention/);
    assert.match(html, /Please fix this build/);
    assert.match(html, /Retry request/);
  });

  it("shows ongoing build activity before the assistant text arrives", () => {
    const html = renderConversation([messages[0], { ...messages[1], status: "streaming", content: "" }]);
    assert.match(html, /Building your changes/);
    assert.match(html, /Assistant is working/);
    assert.match(html, /src\/App.tsx/);
  });
});
