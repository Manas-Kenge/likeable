import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";

async function config(host) {
  const previous = process.env.VITE_DEV_SERVER_HMR_HOST;
  try {
    if (host) process.env.VITE_DEV_SERVER_HMR_HOST = host;
    else delete process.env.VITE_DEV_SERVER_HMR_HOST;
    return (
      await loadConfigFromFile(
        { command: "serve", mode: "development" },
        fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
      )
    ).config;
  } finally {
    if (previous === undefined) delete process.env.VITE_DEV_SERVER_HMR_HOST;
    else process.env.VITE_DEV_SERVER_HMR_HOST = previous;
  }
}

test("local development leaves websocket host, protocol and port to Vite", async () => {
  const result = await config();
  assert.equal(result.server.hmr, undefined);
  assert.equal(result.server.port, 5173);
  assert.equal(result.server.strictPort, true);
});

test("E2B development connects HMR through the sandbox HTTPS proxy", async () => {
  const result = await config("5173-example.e2b.app");
  assert.deepEqual(result.server.hmr, {
    host: "5173-example.e2b.app",
    protocol: "wss",
    clientPort: 443,
  });
  assert.equal(result.server.host, "0.0.0.0");
});
