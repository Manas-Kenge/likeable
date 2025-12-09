// Types for the chat workspace component

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'pending' | 'streaming' | 'complete' | 'error';
  changes?: FileChange[];
  reasoning?: ReasoningStep[];
}

export interface ReasoningStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'file_change';
  status: 'active' | 'complete' | 'pending';
  label: string;
  description?: string;
  timestamp: Date;
}

export interface FileChange {
  path: string;
  action: 'create' | 'update' | 'delete';
  content?: string;
}

export interface StreamEvent {
  type: 'plan' | 'step' | 'files' | 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'file_change' | 'done' | 'error';
  data: unknown;
  timestamp?: string;
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
  content?: string;
}

export interface Project {
  id: string;
  name: string;
  previewUrl?: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
}

export type PreviewTab = 'code' | 'preview';

export interface WorkspaceState {
  project: Project | null;
  messages: ChatMessage[];
  files: FileNode[];
  selectedFile: FileNode | null;
  activeTab: PreviewTab;
  isLoading: boolean;
  previewUrl: string | null;
}
