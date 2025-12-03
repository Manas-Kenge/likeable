import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

/**
 * File change operation
 */
export interface FileChange {
  path: string;
  action: "create" | "update" | "delete";
  content?: string;
}

/**
 * Tool execution record
 */
export interface ToolExecution {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: number;
}

/**
 * Project context stored in memory
 */
export interface ProjectContext {
  projectType?: string;
  framework?: string;
  dependencies?: string[];
  fileStructure?: Record<string, string[]>;
  userPreferences?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Lovable State Annotation
 *
 * This is the main state schema for the Lovable AI coding agent.
 * Uses Annotation.Root for proper TypeScript inference and reducer support.
 */
export const LovableState = Annotation.Root({
  /**
   * Messages - conversation history with the user
   * Uses concat reducer to append new messages
   */
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),

  /**
   * User input - the current request from the user
   * Overrides on update (no reducer)
   */
  userInput: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  /**
   * Current file being edited/viewed
   * Overrides on update
   */
  currentFile: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /**
   * Project files - list of all files in the workspace
   * Uses custom reducer to merge unique file paths
   */
  projectFiles: Annotation<string[]>({
    reducer: (current, update) => {
      const combined = [...current, ...update];
      return [...new Set(combined)]; // Remove duplicates
    },
    default: () => [],
  }),

  /**
   * Pending code changes to apply
   * Uses concat reducer to accumulate changes
   */
  codeChanges: Annotation<FileChange[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),

  /**
   * Tool executions - history of all tool calls
   * Uses concat reducer to append tool execution records
   */
  toolExecutions: Annotation<ToolExecution[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),

  /**
   * Project context - persistent memory/context
   * Uses merge reducer to combine context objects
   */
  projectContext: Annotation<ProjectContext>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),

  /**
   * Current plan - AI's strategy for completing the task
   * Overrides on update
   */
  plan: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /**
   * Planning mode - whether the AI is currently planning
   * Overrides on update
   */
  isPlanning: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),

  /**
   * Error state - stores any error that occurred
   * Overrides on update
   */
  error: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /**
   * Iteration count - number of agent loops taken
   * Uses addition reducer to increment
   */
  iterationCount: Annotation<number>({
    reducer: (current, update) => current + update,
    default: () => 0,
  }),

  /**
   * Completion flag - whether the task is finished
   * Overrides on update
   */
  isComplete: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),

  /**
   * Working directory - current directory context
   * Overrides on update
   */
  workingDirectory: Annotation<string>({
    reducer: (_, update) => update,
    default: () => ".",
  }),

  /**
   * Intermediate results - temporary data between nodes
   * Uses merge reducer
   */
  intermediateResults: Annotation<Record<string, unknown>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),
});

/**
 * Type inference helper - extracts the state type from the annotation
 */
export type LovableStateType = typeof LovableState.State;

/**
 * Type for state updates (partial updates allowed)
 */
export type LovableStateUpdate = Partial<LovableStateType>;
