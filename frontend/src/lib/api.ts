// Use Next.js API routes (proxies to backend)
// This avoids CORS issues and keeps the backend URL private
const API_BASE = "/api";

/**
 * API client for communicating with the Lovable backend via Next.js proxy
 */

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sandboxId?: string;
  previewUrl?: string;
  status: "creating" | "running" | "stopped" | "error";
  files: string[];
  context: Record<string, unknown>;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  status?: "pending" | "streaming" | "complete" | "error";
  changes?: FileChange[];
  reasoning?: ReasoningStep[];
}

export interface ReasoningStep {
  id: string;
  type: "thinking" | "tool_call" | "tool_result" | "file_change";
  status: "active" | "complete" | "pending";
  label: string;
  description?: string;
  timestamp: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  initialPrompt?: string;
}

export interface ChatRequest {
  message: string;
  stream?: boolean;
}

export interface FileChange {
  path: string;
  action: "create" | "update" | "delete";
  content?: string;
}

export interface ChatResponse {
  message: string;
  changes: FileChange[];
  previewUrl?: string;
  status: "success" | "pending_approval" | "error";
  interrupt?: {
    type: string;
    message: string;
    options: string[];
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      const data = await response.json();
      return data as ApiResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==================== Project APIs ====================

  async createProject(
    request: CreateProjectRequest
  ): Promise<ApiResponse<Project>> {
    return this.fetch<Project>("/project", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getProject(projectId: string): Promise<ApiResponse<Project>> {
    return this.fetch<Project>(`/project/${projectId}`);
  }

  async getProjects(): Promise<ApiResponse<Project[]>> {
    return this.fetch<Project[]>("/project");
  }

  // ==================== Chat APIs ====================

  async sendMessage(
    projectId: string,
    message: string
  ): Promise<ApiResponse<ChatResponse>> {
    return this.fetch<ChatResponse>(`/project/${projectId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, stream: false }),
    });
  }

  async *streamMessage(
    projectId: string,
    message: string
  ): AsyncGenerator<string, void, unknown> {
    const url = `${this.baseUrl}/project/${projectId}/chat`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error("Stream failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          yield data;
        }
      }
    }
  }

  // ==================== File APIs ====================

  async getProjectFiles(projectId: string): Promise<ApiResponse<string[]>> {
    return this.fetch<string[]>(`/project/${projectId}/files`);
  }

  async getFileContent(
    projectId: string,
    filePath: string
  ): Promise<ApiResponse<{ path: string; content: string }>> {
    return this.fetch<{ path: string; content: string }>(
      `/project/${projectId}/file?path=${encodeURIComponent(filePath)}`
    );
  }
}

// Export singleton instance
export const api = new ApiClient();

// Export class for custom instances
export { ApiClient };
