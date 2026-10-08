import { CommandExitError, type Sandbox } from "e2b";
import { BASE_PATH } from "../src/paths";

// Only the external sandbox transport is replaced; filesystem state is real in-memory data.
export function sandboxFixture(
  id: string,
  seed: Record<string, string | Uint8Array> = {},
) {
  const source = new Map(
    Object.entries(seed).map(([path, content]) => [
      path,
      typeof content === "string" ? new TextEncoder().encode(content) : content,
    ]),
  );
  const state = {
    alive: true,
    failWrites: false,
    failBuild: false,
    throwBuildError: false,
    symlink: false,
    check: async () => state.alive,
  };
  const sandbox = {
    sandboxId: id,
    getHost: () => `${id}.e2b.app`,
    isRunning: () => state.check(),
    kill: async () => {
      state.alive = false;
    },
    files: {
      list: async (directory: string) => {
        const prefix =
          directory === BASE_PATH
            ? ""
            : directory.slice(BASE_PATH.length + 1) + "/";
        const entries = new Map<
          string,
          { name: string; type: "dir" | "file" }
        >();
        for (const path of source.keys())
          if (path.startsWith(prefix)) {
            const rest = path.slice(prefix.length);
            const name = rest.split("/")[0]!;
            entries.set(name, {
              name,
              type: rest.includes("/") ? "dir" : "file",
            });
          }
        return [...entries.values()];
      },
      read: async (path: string, options?: { format?: string }) => {
        const data = source.get(path.slice(BASE_PATH.length + 1));
        if (!data) throw new Error("File not found");
        return options?.format === "bytes"
          ? data
          : new TextDecoder().decode(data);
      },
      write: async (path: string, data: string | Blob | ArrayBuffer) => {
        if (state.failWrites) throw new Error("Disk write failed");
        source.set(
          path.slice(BASE_PATH.length + 1),
          typeof data === "string"
            ? new TextEncoder().encode(data)
            : new Uint8Array(
                data instanceof Blob ? await data.arrayBuffer() : data,
              ),
        );
      },
      remove: async (path: string) => {
        source.delete(path.slice(BASE_PATH.length + 1));
      },
    },
    commands: {
      run: async (command: string) => {
        if (command.startsWith("realpath -m -- "))
          return {
            exitCode: 0,
            stdout: state.symlink
              ? "/etc/passwd\n"
              : command.slice("realpath -m -- '".length, -1) + "\n",
            stderr: "",
          };
        if (command.includes("curl "))
          return { exitCode: 0, stdout: "200", stderr: "" };
        if (command.includes("npm run build") && state.throwBuildError)
          throw new CommandExitError({
            exitCode: 1,
            stdout: "",
            stderr: "TS1005: missing brace",
            error: "exit status 1",
          });
        if (command.includes("npm run build") && state.failBuild)
          return { exitCode: 1, stdout: "", stderr: "TS1005: missing brace" };
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    },
  } as unknown as Sandbox;
  return { sandbox, source, state };
}
