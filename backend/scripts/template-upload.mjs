// E2B 2.7 measures one gzip stream and uploads a separately generated stream.
// Their byte lengths can differ. Buffer the small source archive once so the
// request's Content-Length describes the bytes actually sent. This wrapper is
// scoped to the standalone build command; it never runs in the app server.
export async function withBufferedTemplateUploads(build) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    if (options?.method === "PUT" && options.body?.[Symbol.asyncIterator]) {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of options.body) {
        const data = Buffer.from(chunk);
        bytes += data.length;
        if (bytes > 50 * 1024 * 1024)
          throw new Error("Template source archive exceeds 50 MB");
        chunks.push(data);
      }
      const body = Buffer.concat(chunks);
      const headers = new Headers(options.headers);
      headers.set("Content-Length", String(body.length));
      options = { ...options, body, headers };
    }
    return originalFetch(input, options);
  };
  try {
    return await build();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
