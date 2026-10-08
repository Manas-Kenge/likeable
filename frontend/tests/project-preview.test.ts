import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadProjectPreview } from "../src/lib/project-preview";
import type { Project } from "../src/lib/api";

const project = (overrides: Partial<Project> = {}): Project => ({
  id: "project-1", name: "My portfolio", status: "running",
  generationStatus: "idle", createdAt: "2026-10-08T10:00:00Z",
  updatedAt: "2026-10-08T10:00:00Z", files: [], messages: [],
  previewUrl: "https://5173-example.e2b.app", ...overrides,
});

describe("saved project previews", () => {
  it("uses the current session URL instead of a stale URL from the list", async () => {
    const current = project({ previewUrl: "https://5173-current.e2b.app" });
    const preview = await loadProjectPreview("project-1", async (id) => {
      assert.equal(id, "project-1");
      return { success: true, data: current };
    });
    assert.equal(preview.url, "https://5173-current.e2b.app/");
    assert.equal(preview.project, current);
  });

  it("does not embed an expired session even when its old URL remains saved", async () => {
    const preview = await loadProjectPreview("project-1", async () => ({
      success: true, data: project({ status: "stopped" }),
    }));
    assert.equal(preview.url, null);
    assert.equal(preview.state, "stopped");
  });

  it("rejects malformed URLs, credentials and executable URL schemes", async () => {
    for (const previewUrl of ["not a URL", "javascript:alert(1)", "data:text/html,hello", "https://user:password@example.com/"]) {
      const preview = await loadProjectPreview("project-1", async () => ({
        success: true, data: project({ previewUrl }),
      }));
      assert.equal(preview.url, null);
      assert.equal(preview.state, "unavailable");
    }
  });

  it("keeps cards usable when the project API fails or returns no data", async () => {
    const failed = await loadProjectPreview("project-1", async () => ({ success: false, error: "Offline" }));
    const incomplete = await loadProjectPreview("project-1", async () => ({ success: true }));
    const thrown = await loadProjectPreview("project-1", async () => { throw new Error("Offline"); });
    for (const preview of [failed, incomplete, thrown]) {
      assert.equal(preview.url, null);
      assert.equal(preview.state, "unavailable");
    }
  });
});
