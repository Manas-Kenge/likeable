import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Template, defaultBuildLogger } from "e2b";
import { withBufferedTemplateUploads } from "./template-upload.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
config({ path: resolve(root, ".env"), quiet: true });
if (!process.env.E2B_API_KEY?.trim())
  throw new Error(
    "Configure E2B_API_KEY in backend/.env before building the template.",
  );

// Build remotely: no local Docker daemon or legacy account IDs are required.
const template = Template({ fileContextPath: root }).fromDockerfile(
  resolve(root, "e2b.Dockerfile"),
);
try {
  const result = await withBufferedTemplateUploads(() =>
    Template.build(template, {
      alias: process.env.E2B_TEMPLATE_NAME || "likeable-react-dev",
      cpuCount: 2,
      memoryMB: 2048,
      onBuildLogs: defaultBuildLogger(),
    }),
  );
  console.log(`Template ready: ${result.templateId}`);
  console.log(`Set E2B_TEMPLATE_ID=${result.templateId} in backend/.env.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    message.replace(/https?:\/\/[^\s]+/g, (value) => {
      try {
        const url = new URL(value);
        return `${url.origin}${url.pathname}`;
      } catch {
        return "[URL]";
      }
    }),
  );
  process.exitCode = 1;
}
