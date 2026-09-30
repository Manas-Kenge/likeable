import type { ChatMessage as SavedMessage } from "../../../../shared/types";
export type {
  Project,
  FileChange,
  StreamEvent,
} from "../../../../shared/types";
export interface Activity {
  id: string;
  label: string;
  status: "active" | "complete" | "error";
}
export type ChatMessage = SavedMessage & { activity?: Activity[] };
export interface FileNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
  content?: string;
}
export type PreviewTab = "code" | "preview";
