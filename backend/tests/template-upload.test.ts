import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { withBufferedTemplateUploads } from "../scripts/template-upload.mjs";

test("template uploads send the entire archive with its actual length", async () => {
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    response.end(Buffer.concat(chunks));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No listener");
  const originalFetch = globalThis.fetch;
  try {
    const result = await withBufferedTemplateUploads(async () =>
      fetch(`http://127.0.0.1:${address.port}`, {
        method: "PUT",
        headers: { "Content-Length": "4" },
        body: Readable.from([Buffer.from("whole")]),
        // Node requires this for streamed request bodies.
        duplex: "half",
      } as RequestInit),
    );
    expect(await result.text()).toBe("whole");
    expect(globalThis.fetch).toBe(originalFetch);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("the build command restores fetch when template creation fails", async () => {
  const originalFetch = globalThis.fetch;
  await expect(
    withBufferedTemplateUploads(async () => {
      throw new Error("Build failed");
    }),
  ).rejects.toThrow("Build failed");
  expect(globalThis.fetch).toBe(originalFetch);
});
