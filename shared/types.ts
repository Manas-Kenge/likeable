export type SandboxStatus = "creating" | "running" | "stopped" | "error";
export type RunStatus = "running" | "completed" | "failed";
export interface FileChange {
  path: string;
  action: "create" | "update" | "delete";
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  status: "streaming" | "complete" | "error";
  runId: string;
  changes: FileChange[];
}
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sandboxId?: string;
  previewUrl?: string;
  status: SandboxStatus;
  generationStatus: "idle" | RunStatus;
  initialPrompt?: string;
  initialRunId?: string;
  files: string[];
  messages: ChatMessage[];
}
export interface GenerationRun {
  id: string;
  projectId: string;
  prompt: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  error?: string;
}
export interface CreateProjectRequest {
  name: string;
  description?: string;
  initialPrompt?: string;
}
export interface ChatRequest {
  message: string;
  initial?: boolean;
}
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
export type StreamEvent =
  | { type: "thinking"; data: { message: string } }
  | { type: "plan"; data: string[] }
  | { type: "step"; data: { toolName: string; path?: string | null } }
  | { type: "file_start"; data: { path: string } }
  | { type: "file_complete"; data: FileChange }
  | { type: "validating"; data: { message: string } }
  | { type: "message"; data: { text: string } }
  | { type: "preview_ready"; data: Record<string, never> }
  | { type: "done"; data: { text: string; runId?: string } }
  | { type: "error"; data: { message: string } };
