import type { ModelMessage } from "ai";

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
  messages: ModelMessage[];
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
