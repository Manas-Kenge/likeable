import { config } from "dotenv";
import { resolve } from "node:path";
import { createApp } from "./src/app";
import { streamChat } from "./src/graph";
import { ProjectStore } from "./src/store";
import { ProjectService, e2bProvider } from "./src/project-service";
config();
for (const name of ["ZAI_API_KEY", "E2B_API_KEY", "E2B_TEMPLATE_ID"] as const) {
  if (!process.env[name]?.trim())
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and configure your Z.ai key and accessible E2B template.`,
    );
}
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be a valid TCP port");
const store = new ProjectStore(
  resolve(process.env.DATABASE_PATH || ".data/likeable.sqlite"),
);
const service = new ProjectService(
  store,
  e2bProvider(process.env.E2B_TEMPLATE_ID!),
  streamChat,
);
const app = createApp(service);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`Likeable backend: http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
export default app;
