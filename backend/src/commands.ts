import { CommandExitError } from "e2b";
import type { CommandResult, Sandbox } from "e2b";

// E2B throws on non-zero exits; preserve the stdout/stderr contract for callers.
export async function runSandboxCommand(
  sandbox: Sandbox,
  command: string,
  timeoutMs: number,
): Promise<CommandResult> {
  try {
    return await sandbox.commands.run(command, { timeoutMs });
  } catch (error) {
    if (error instanceof CommandExitError)
      return {
        exitCode: error.exitCode,
        stdout: error.stdout,
        stderr: error.stderr,
        error: error.error,
      };
    throw error;
  }
}
