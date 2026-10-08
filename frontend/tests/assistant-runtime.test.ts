import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fromThreadMessageLike } from "@assistant-ui/react";
import { convertMessage, getPromptText, getRetryPrompt } from "../src/components/chat-workspace/assistant-runtime";
import type { ChatMessage } from "../src/components/chat-workspace/types";

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "assistant-1", role: "assistant", content: "Built **your app**.",
  timestamp: "2026-09-30T10:00:00.000Z", status: "complete", runId: "run-1",
  changes: [{ path: "src/App.tsx", action: "update" }], ...overrides,
});

describe("assistant-ui message adapter", () => {
  it("preserves saved identity, dates and Markdown through the real runtime converter", () => {
    const result = fromThreadMessageLike(convertMessage(message()), "fallback", { type: "running" });
    assert.equal(result.id, "assistant-1");
    assert.equal(result.createdAt.toISOString(), "2026-09-30T10:00:00.000Z");
    assert.deepEqual(result.content, [{ type: "text", text: "Built **your app**." }]);
    assert.deepEqual(result.status, { type: "complete", reason: "stop" });
  });

  it("keeps the same assistant id as streaming turns into a failed run", () => {
    const streaming = convertMessage(message({ status: "streaming", content: "" }));
    const failed = convertMessage(message({ status: "error", content: "Build failed" }));
    assert.equal(streaming.id, failed.id);
    assert.deepEqual(streaming.status, { type: "running" });
    assert.deepEqual(failed.status, { type: "incomplete", reason: "error" });
    assert.equal(convertMessage(message({ role: "user" })).status, undefined);
  });

  it("submits trimmed text parts in order without turning non-text parts into a prompt", () => {
    assert.equal(getPromptText([{ type: "text", text: " Improve " }, { type: "text", text: "the header " }]), "Improve the header");
    assert.equal(getPromptText([]), "");
    assert.throws(() => getPromptText([{ type: "image", image: "https://example.com/image.png" }]), /text/i);
  });

  it("retries the user request immediately before the failed message, not a later request", () => {
    const messages = [message({ id: "u1", role: "user", content: "Build an app" }), message(),
      message({ id: "u2", role: "user", content: "Improve the header" }), message({ id: "failed", status: "error" }),
      message({ id: "u3", role: "user", content: "Change the footer" })];
    assert.equal(getRetryPrompt(messages, "failed"), "Improve the header");
    assert.equal(getRetryPrompt([message({ status: "error" })], "assistant-1"), "Fix the build errors in this project.");
    assert.equal(getRetryPrompt(messages, "missing"), "Fix the build errors in this project.");
  });
});
