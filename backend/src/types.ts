/**
 * Project Types
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

export interface FileChange {
  path: string;
  action: "create" | "update" | "delete";
  content?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
