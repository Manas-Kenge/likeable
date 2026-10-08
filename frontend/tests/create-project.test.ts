import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMessageNotSentError } from "@assistant-ui/react";
import { createProjectFromPrompt } from "../src/lib/create-project";
import type { ApiClient } from "../src/lib/api";

describe("landing composer project creation", () => {
  it("creates a project from trimmed text and returns its route id", async () => {
    let request: Parameters<ApiClient["createProject"]>[0] | undefined;
    const id = await createProjectFromPrompt([{ type: "text", text: "  Build a reading list  " }], async (body) => {
      request = body;
      return { success: true, data: {
        id: "project-1", name: body.name, status: "running", generationStatus: "idle",
        createdAt: "2026-09-30T10:00:00Z", updatedAt: "2026-09-30T10:00:00Z", files: [], messages: [],
      } };
    });
    assert.equal(id, "project-1");
    assert.deepEqual(request, { name: "Build a reading list", description: "Build a reading list", initialPrompt: "Build a reading list" });
  });

  it("marks rejected creation as unsent so assistant-ui restores the draft", async () => {
    await assert.rejects(
      createProjectFromPrompt([{ type: "text", text: "Build an app" }], async () => ({ success: false, error: "Template unavailable" })),
      (error: unknown) => isMessageNotSentError(error) && (error as Error).message === "Template unavailable",
    );
  });

  it("handles thrown network failures and incomplete success responses as unsent", async () => {
    await assert.rejects(createProjectFromPrompt([{ type: "text", text: "Build an app" }], async () => { throw new Error("Network unavailable"); }), isMessageNotSentError);
    await assert.rejects(createProjectFromPrompt([{ type: "text", text: "Build an app" }], async () => ({ success: true })), isMessageNotSentError);
  });

  it("rejects whitespace without making a creation request", async () => {
    let calls = 0;
    await assert.rejects(createProjectFromPrompt([{ type: "text", text: "  " }], async () => { calls++; return { success: false }; }), isMessageNotSentError);
    assert.equal(calls, 0);
  });
});
