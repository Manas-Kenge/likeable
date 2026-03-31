'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import type {
  ChatMessage,
  FileNode,
  Project,
  PreviewTab,
  WorkspaceState,
  ReasoningStep,
  StreamEvent,
} from './types';

// Helper to get initial state, checking sessionStorage for pending prompt
function getInitialState(): WorkspaceState & { pendingPrompt: string | null } {
  // Check for pending prompt from navigation (only on client)
  const pendingPrompt = typeof window !== 'undefined'
    ? sessionStorage.getItem('pendingPrompt')
    : null;

  if (pendingPrompt) {
    // Clear it immediately to prevent re-use on refresh
    sessionStorage.removeItem('pendingPrompt');

    // Return initial state with user message + analyzing assistant message
    return {
      project: null,
      messages: [
        {
          id: 'msg-pending-1',
          role: 'user',
          content: pendingPrompt,
          timestamp: new Date(),
          status: 'complete',
        },
        {
          id: 'msg-pending-2',
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          status: 'streaming',
          reasoning: [{
            id: 'reason-initial',
            type: 'thinking',
            status: 'active',
            label: 'Analyzing your request...',
            timestamp: new Date(),
          }],
        },
      ],
      files: [],
      selectedFile: null,
      activeTab: 'preview',
      isLoading: true,
      previewUrl: null,
      pendingPrompt,
    };
  }

  // Default empty state
  return {
    project: null,
    messages: [],
    files: [],
    selectedFile: null,
    activeTab: 'preview',
    isLoading: false,
    previewUrl: null,
    pendingPrompt: null,
  };
}

export function useWorkspace(projectId?: string) {
  // Use lazy initializer to check sessionStorage on first render
  const [initialData] = useState(getInitialState);
  const [state, setState] = useState<WorkspaceState>({
    project: initialData.project,
    messages: initialData.messages,
    files: initialData.files,
    selectedFile: initialData.selectedFile,
    activeTab: initialData.activeTab,
    isLoading: initialData.isLoading,
    previewUrl: initialData.previewUrl,
    previewReloadTrigger: 0,
  });

  // Store pending prompt for use in loadProject
  const pendingPromptRef = useRef<string | null>(initialData.pendingPrompt);
  const messageIdCounter = useRef(10); // Start at 10 to avoid conflicts with pending messages
  const reasoningIdCounter = useRef(0);
  const initialLoadStarted = useRef(false);

  // Process streaming response for a message
  const processStream = useCallback(async (
    projectId: string,
    message: string,
    assistantMessageId: string
  ) => {
    try {
      const streamGenerator = api.streamMessage(projectId, message);
      const allChanges: { path: string; action: 'create' | 'update' | 'delete' }[] = [];

      for await (const chunk of streamGenerator) {
        try {
          const event: StreamEvent = JSON.parse(chunk);

          switch (event.type) {
            case 'thinking': {
              const thinkingData = event.data as { message?: string };
              setState((prev) => ({
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        reasoning: markPreviousComplete(msg.reasoning || [], {
                          id: `reason-${++reasoningIdCounter.current}`,
                          type: 'thinking',
                          status: 'active',
                          label: thinkingData?.message || 'Thinking...',
                          timestamp: new Date(),
                        }),
                      }
                    : msg
                ),
              }));
              break;
            }

            case 'plan': {
              const plan = Array.isArray(event.data) ? event.data : [];
              setState((prev) => ({
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        reasoning: markPreviousComplete(msg.reasoning || [], {
                          id: `reason-${++reasoningIdCounter.current}`,
                          type: 'thinking',
                          status: 'complete',
                          label: `Created ${plan.length} step plan`,
                          description: plan.map((s, i) => `${i + 1}. ${s}`).join('\n'),
                          timestamp: new Date(),
                        }),
                      }
                    : msg
                ),
              }));
              break;
            }

            case 'step': {
              const stepData = event.data as { toolName?: string; path?: string; description?: string };
              const toolName = stepData?.toolName ?? null;
              const filePath = stepData?.path ?? null;

              let label: string;
              if (toolName === 'read_file' && filePath) {
                label = `Reading ${filePath}`;
              } else if (toolName === 'run_command') {
                label = 'Running command';
              } else if (toolName === 'list_files') {
                label = 'Listing files';
              } else if (toolName) {
                label = filePath ? `${toolName}: ${filePath}` : toolName;
              } else {
                label = stepData?.description || 'Working...';
              }

              setState((prev) => ({
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        reasoning: markPreviousComplete(msg.reasoning || [], {
                          id: `reason-${++reasoningIdCounter.current}`,
                          type: 'tool_call',
                          status: 'active',
                          label,
                          toolName: toolName ?? undefined,
                          filePath: filePath ?? undefined,
                          timestamp: new Date(),
                        }),
                      }
                    : msg
                ),
              }));
              break;
            }

            case 'file_start': {
              const fileData = event.data as { path?: string };
              const filePath = fileData?.path || 'unknown';
              setState((prev) => ({
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        reasoning: [...(msg.reasoning || []), {
                          id: `reason-${++reasoningIdCounter.current}`,
                          type: 'file_working',
                          status: 'active',
                          label: `Writing ${filePath}...`,
                          filePath,
                          timestamp: new Date(),
                        }],
                      }
                    : msg
                ),
              }));
              break;
            }

            case 'file_complete': {
              const fileData = event.data as { path?: string; action?: string };
              const filePath = fileData?.path || '';
              allChanges.push({ path: filePath, action: 'update' });

              setState((prev) => ({
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        changes: [...allChanges],
                        reasoning: (msg.reasoning || []).map((r) =>
                          r.filePath === filePath && r.type === 'file_working'
                            ? { ...r, type: 'file_change' as const, status: 'complete' as const, label: `Updated ${filePath}` }
                            : r
                        ),
                      }
                    : msg
                ),
              }));
              break;
            }

            case 'files': {
              const files = Array.isArray(event.data) ? event.data : [];
              files.forEach((file) => {
                allChanges.push({ path: file, action: 'update' });
              });
              // Don't add a separate reasoning step - file_start/file_complete handle it
              break;
            }

            case 'done': {
              setState((prev) => ({
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: 'Completed all tasks',
                        status: 'complete' as const,
                        changes: [...allChanges],
                        reasoning: (msg.reasoning || []).map((r) => ({
                          ...r,
                          status: 'complete' as const,
                        })),
                      }
                    : msg
                ),
                isLoading: false,
              }));

              // Refresh file tree after changes
              if (allChanges.length > 0) {
                const filesRes = await api.getProjectFiles(projectId);
                if (filesRes.success) {
                  setState((prev) => ({
                    ...prev,
                    files: buildFileTree(filesRes.data || []),
                  }));
                }
              }

              // Preview reload is now handled by the 'preview_ready' event from backend
              // which waits for the dev server to actually be ready
              break;
            }

            case 'preview_ready': {
              setState((prev) => ({
                ...prev,
                previewReloadTrigger: (prev.previewReloadTrigger || 0) + 1,
              }));
              break;
            }

            case 'error': {
              const errMsg = (event.data as { message?: string })?.message || 'An error occurred';
              setState((prev) => ({
                ...prev,
                messages: prev.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: errMsg,
                        status: 'error' as const,
                      }
                    : msg
                ),
                isLoading: false,
              }));
              break;
            }
          }
        } catch {
          // Skip invalid JSON chunks
        }
      }

      // Ensure we mark as complete even if no done event
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === assistantMessageId && msg.status === 'streaming'
            ? {
                ...msg,
                content: msg.content || 'Completed',
                status: 'complete' as const,
              }
            : msg
        ),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Stream processing failed:', error);
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: 'Failed to get response. Please try again.',
                status: 'error' as const,
              }
            : msg
        ),
        isLoading: false,
      }));
    }
  }, []);

  // Load project data
  const loadProject = useCallback(async (id: string) => {
    // Check if we have a pending prompt from sessionStorage
    const hasPendingPrompt = pendingPromptRef.current !== null;
    const pendingPrompt = pendingPromptRef.current;

    // If no pending prompt, set loading state
    if (!hasPendingPrompt) {
      setState((prev) => ({ ...prev, isLoading: true }));
    }

    try {
      const [projectRes, filesRes] = await Promise.all([
        api.getProject(id),
        api.getProjectFiles(id),
      ]);

      if (projectRes.success && projectRes.data) {
        const projectData = projectRes.data;
        const project: Project = {
          id: projectData.id,
          name: projectData.name,
          previewUrl: projectData.previewUrl,
          status: projectData.status,
        };

        // Convert file paths to FileNode tree
        const files = buildFileTree(filesRes.data || []);

        // Check project context for initial prompt info
        const context = projectData.context as Record<string, unknown> | undefined;
        const initialPrompt = context?.initialPrompt as string | undefined;
        const hasReceivedMessage = context?.hasReceivedMessage as boolean | undefined;

        // Case 1: We have a pending prompt from sessionStorage (immediate display)
        if (hasPendingPrompt && pendingPrompt) {

          // Clear the ref
          pendingPromptRef.current = null;

          // Update state with project/files, keep existing messages
          setState((prev) => ({
            ...prev,
            project,
            files,
            previewUrl: project.previewUrl || null,
          }));

          // Start streaming with the pending assistant message ID
          processStream(id, pendingPrompt, 'msg-pending-2');
        }
        // Case 2: Initial prompt exists but hasn't been processed (fallback for direct URL access)
        else if (initialPrompt && !hasReceivedMessage) {

          const userMessageId = `msg-${++messageIdCounter.current}`;
          const assistantMessageId = `msg-${++messageIdCounter.current}`;

          const initialMessages: ChatMessage[] = [
            {
              id: userMessageId,
              role: 'user',
              content: initialPrompt,
              timestamp: new Date(projectData.createdAt),
              status: 'complete',
            },
            {
              id: assistantMessageId,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              status: 'streaming',
              reasoning: [{
                id: 'reason-initial',
                type: 'thinking',
                status: 'active',
                label: 'Analyzing your request...',
                timestamp: new Date(),
              }],
            },
          ];

          setState((prev) => ({
            ...prev,
            project,
            files,
            messages: initialMessages,
            previewUrl: project.previewUrl || null,
            isLoading: true,
          }));

          // Start streaming the initial prompt
          processStream(id, initialPrompt, assistantMessageId);
        }
        // Case 3: Already processed - just show the user message
        else if (initialPrompt && hasReceivedMessage) {
          const initialMessages: ChatMessage[] = [
            {
              id: `msg-${++messageIdCounter.current}`,
              role: 'user',
              content: initialPrompt,
              timestamp: new Date(projectData.createdAt),
              status: 'complete',
            },
          ];

          setState((prev) => ({
            ...prev,
            project,
            files,
            messages: initialMessages,
            previewUrl: project.previewUrl || null,
            isLoading: false,
          }));
        }
        // Case 4: No initial prompt
        else {
          setState((prev) => ({
            ...prev,
            project,
            files,
            previewUrl: project.previewUrl || null,
            isLoading: false,
          }));
        }
      } else {
        console.error(`[useWorkspace] Project response not successful:`, projectRes.error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('[useWorkspace] Failed to load project:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [processStream]);

  // Create new project
  const createProject = useCallback(async (name: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await api.createProject({ name });

      if (response.success && response.data) {
        const project: Project = {
          id: response.data.id,
          name: response.data.name,
          previewUrl: response.data.previewUrl,
          status: response.data.status,
        };

        setState((prev) => ({
          ...prev,
          project,
          previewUrl: project.previewUrl || null,
          isLoading: false,
        }));

        return project;
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }

    setState((prev) => ({ ...prev, isLoading: false }));
    return null;
  }, []);

  // Send message to AI with streaming
  const sendMessage = useCallback(
    async (content: string) => {
      if (!state.project) return;

      const userMessageId = `msg-${++messageIdCounter.current}`;
      const assistantMessageId = `msg-${++messageIdCounter.current}`;

      // Add user message
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content,
        timestamp: new Date(),
        status: 'complete',
      };

      // Add pending assistant message with analyzing reasoning
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        status: 'streaming',
        reasoning: [{
          id: 'reason-initial',
          type: 'thinking',
          status: 'active',
          label: 'Analyzing your request...',
          timestamp: new Date(),
        }],
        changes: [],
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage, assistantMessage],
        isLoading: true,
      }));

      // Use the shared processStream function
      await processStream(state.project.id, content, assistantMessageId);
    },
    [state.project, processStream]
  );

  // Select file and load content
  const selectFile = useCallback(
    async (file: FileNode) => {
      if (file.isFolder || !state.project) return;

      setState((prev) => ({ ...prev, selectedFile: file, activeTab: 'code' }));

      // Load file content if not already loaded
      if (!file.content) {
        try {
          const response = await api.getFileContent(state.project.id, file.path);
          if (response.success && response.data) {
            setState((prev) => ({
              ...prev,
              selectedFile: { ...file, content: response.data!.content },
              files: updateFileContent(prev.files, file.path, response.data!.content),
            }));
          }
        } catch (error) {
          console.error('Failed to load file content:', error);
        }
      }
    },
    [state.project]
  );

  // Set active tab
  const setActiveTab = useCallback((tab: PreviewTab) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  // Load project on mount
  useEffect(() => {
    if (projectId && !initialLoadStarted.current) {
      initialLoadStarted.current = true;
      loadProject(projectId);
    }
  }, [projectId, loadProject]);

  return {
    ...state,
    loadProject,
    createProject,
    sendMessage,
    selectFile,
    setActiveTab,
  };
}

// Helper: Mark previous reasoning steps as complete and add new one
function markPreviousComplete(
  reasoning: ReasoningStep[],
  newStep: ReasoningStep
): ReasoningStep[] {
  return [
    ...reasoning.map((r) => ({ ...r, status: 'complete' as const })),
    newStep,
  ];
}

// Helper: Build file tree from flat paths
function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  // Sort paths to ensure parent directories come first
  const sortedPaths = [...paths].sort();

  for (const path of sortedPaths) {
    const parts = path.split('/').filter(Boolean);
    let currentPath = '';
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let node = nodeMap.get(currentPath);

      if (!node) {
        node = {
          id: currentPath,
          name: part,
          path: currentPath,
          isFolder: !isLast,
          children: isLast ? undefined : [],
        };
        nodeMap.set(currentPath, node);
        currentLevel.push(node);
      }

      if (!isLast && node.children) {
        currentLevel = node.children;
      }
    }
  }

  return root;
}

// Helper: Update file content in tree
function updateFileContent(
  files: FileNode[],
  path: string,
  content: string
): FileNode[] {
  return files.map((file) => {
    if (file.path === path) {
      return { ...file, content };
    }
    if (file.children) {
      return { ...file, children: updateFileContent(file.children, path, content) };
    }
    return file;
  });
}
