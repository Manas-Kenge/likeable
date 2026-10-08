import { expect, test } from "bun:test";
import { createFileTools } from "../src/tools";
import { sandboxFixture } from "./sandbox-fixture";
const options = { toolCallId: "write", messages: [], context: {} };
test("a failed disk write returns a structured failure and does not save a checkpoint", async () => {
  const fixture = sandboxFixture("app");
  fixture.state.failWrites = true;
  const saved: string[] = [];
  const tools = createFileTools(fixture.sandbox, async (_path, content) => {
    saved.push(content);
  });
  const result = await tools.write_file.execute!(
    { path: "src/App.tsx", content: "new source" },
    options,
  );
  expect(result).toEqual({
    success: false,
    path: "src/App.tsx",
    error: "Disk write failed",
  });
  expect(saved).toEqual([]);
  expect(fixture.source.has("src/App.tsx")).toBe(false);
});
test("successful writes save complete content and unsafe paths cannot modify source", async () => {
  const fixture = sandboxFixture("app");
  const saved: string[] = [];
  const tools = createFileTools(fixture.sandbox, async (_path, content) => {
    saved.push(content);
  });
  const result = await tools.write_file.execute!(
    { path: "src/App.tsx", content: "new source" },
    options,
  );
  expect(result).toEqual({
    success: true,
    path: "src/App.tsx",
    action: "update",
  });
  expect(saved).toEqual(["new source"]);
  const unsafe = await tools.write_file.execute!(
    { path: "../outside.ts", content: "unsafe" },
    options,
  );
  expect(unsafe).toMatchObject({ success: false });
  expect([...fixture.source.keys()]).toEqual(["src/App.tsx"]);
});

test("relative aliases checkpoint and report the same canonical source path", async () => {
  const fixture = sandboxFixture("app");
  const saved: string[] = [];
  const tools = createFileTools(fixture.sandbox, async (path) => {
    saved.push(path);
  });
  const result = await tools.write_file.execute!(
    { path: "./src//App.tsx", content: "updated" },
    options,
  );
  expect(result).toMatchObject({ success: true, path: "src/App.tsx" });
  expect(saved).toEqual(["src/App.tsx"]);
  expect(new TextDecoder().decode(fixture.source.get("src/App.tsx"))).toBe(
    "updated",
  );
});
