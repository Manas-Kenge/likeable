import type {
  ApiResponse,
  CreateProjectRequest,
  Project,
  StreamEvent,
} from "../../../shared/types";
export type {
  ApiResponse,
  CreateProjectRequest,
  Project,
  StreamEvent,
} from "../../../shared/types";

export class ApiClient {
  constructor(private baseUrl = "/api") {}
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...options?.headers },
      });
      const data = (await response.json()) as ApiResponse<T>;
      if (!response.ok)
        return {
          success: false,
          error: data.error || `Request failed (${response.status})`,
        };
      return data;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to reach the server",
      };
    }
  }
  createProject(request: CreateProjectRequest) {
    return this.request<Project>("/project", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }
  getProject(id: string) {
    return this.request<Project>(`/project/${id}`);
  }
  getProjects() {
    return this.request<Project[]>("/project");
  }
  resumeProject(id: string) {
    return this.request<Project>(`/project/${id}/resume`, { method: "POST" });
  }
  getProjectFiles(id: string) {
    return this.request<string[]>(`/project/${id}/files`);
  }
  getFileContent(id: string, path: string) {
    return this.request<{ path: string; content: string }>(
      `/project/${id}/file?path=${encodeURIComponent(path)}`,
    );
  }
  exportUrl(id: string) {
    return `${this.baseUrl}/project/${id}/export`;
  }

  async *streamMessage(
    id: string,
    message: string,
    options: { initial?: boolean; signal?: AbortSignal } = {},
  ): AsyncGenerator<StreamEvent> {
    const response = await fetch(`${this.baseUrl}/project/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, initial: options.initial }),
      signal: options.signal,
    });
    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        data?.error || `Generation request failed (${response.status})`,
      );
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let terminal = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += done
          ? decoder.decode()
          : decoder.decode(value, { stream: true });
        let match: RegExpExecArray | null;
        while ((match = /\r?\n\r?\n/.exec(buffer))) {
          const frame = buffer.slice(0, match.index);
          buffer = buffer.slice(match.index + match[0].length);
          const payload = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (!payload) continue;
          if (payload === "[DONE]") {
            if (!terminal)
              throw new Error(
                "Generation stream interrupted before a result arrived. Retry your request.",
              );
            return;
          }
          const event = JSON.parse(payload) as StreamEvent;
          if (!event || typeof event.type !== "string" || !("data" in event))
            throw new Error("Invalid generation event received");
          if (terminal) continue;
          if (event.type === "done" || event.type === "error") terminal = true;
          yield event;
        }
        if (done) break;
      }
      if (!terminal)
        throw new Error(
          "Generation stream interrupted. Partial changes may have been saved; retry your request.",
        );
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
export const api = new ApiClient();
