'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
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

export function useWorkspace(projectId?: string) {
  const [state, setState] = useState<WorkspaceState>({
    project: null,
    messages: [],
    files: [],
    selectedFile: null,
    activeTab: 'preview',
    isLoading: false,
    previewUrl: null,
  });

  const messageIdCounter = useRef(0);
  const reasoningIdCounter = useRef(0);
  const initialPromptProcessed = useRef(false);

  // Process streaming response for a message
  const processStream = useCallback(async (
    projectId: string,
    message: string,
    assistantMessageId: string
  ) => {
    console.log(`[processStream] Starting stream for project ${projectId}`);
    console.log(`[processStream] Message: ${message.substring(0, 50)}...`);
    console.log(`[processStream] Assistant message ID: ${assistantMessageId}`);

    try {
      const streamGenerator = api.streamMessage(projectId, message);
      const allChanges: { path: string; action: 'create' | 'update' | 'delete' }[] = [];
      let chunkCount = 0;

      for await (const chunk of streamGenerator) {
        chunkCount++;
        console.log(`[processStream] Received chunk ${chunkCount}:`, chunk.substring(0, 100));
        try {
          const event: StreamEvent = JSON.parse(chunk);

          switch (event.type) {
            case 'plan': {
              const plan = Array.isArray(event.data) ? event.data : [];
              flushSync(() => {
                setState((prev) => ({
                  ...prev,
                  messages: prev.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          reasoning: [{
                            id: `reason-${++reasoningIdCounter.current}`,
                            type: 'thinking',
                            status: 'complete',
                            label: `Planning ${plan.length} steps`,
                            timestamp: new Date(),
                          }],
                        }
                      : msg
                  ),
                }));
              });
              break;
            }

            case 'step': {
              const stepNum = (event.data as { num?: number; description?: string })?.num || 0;
              const description = (event.data as { num?: number; description?: string })?.description || '';
              flushSync(() => {
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
                            label: description || `Executing step ${stepNum}`,
                            timestamp: new Date(),
                          }),
                        }
                      : msg
                  ),
                }));
              });
              break;
            }

            case 'files': {
              const files = Array.isArray(event.data) ? event.data : [];
              files.forEach((file) => {
                allChanges.push({ path: file, action: 'update' });
              });

              flushSync(() => {
                setState((prev) => ({
                  ...prev,
                  messages: prev.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          changes: [...allChanges],
                          reasoning: [...(msg.reasoning || []), {
                            id: `reason-${++reasoningIdCounter.current}`,
                            type: 'file_change',
                            status: 'complete',
                            label: `Modified ${files.length} file(s)`,
                            timestamp: new Date(),
                          }],
                        }
                      : msg
                  ),
                }));
              });
              break;
            }

            case 'done': {
              flushSync(() => {
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
              });

              // Refresh file tree
              if (allChanges.length > 0) {
                const filesRes = await api.getProjectFiles(projectId);
                if (filesRes.success) {
                  flushSync(() => {
                    setState((prev) => ({
                      ...prev,
                      files: buildFileTree(filesRes.data || []),
                      // Bust cache so iframe reloads the updated app
                      previewUrl: prev.project?.previewUrl
                        ? `${prev.project.previewUrl}?t=${Date.now()}`
                        : prev.previewUrl,
                    }));
                  });
                }
              }
              break;
            }

            case 'error': {
              const errMsg = (event.data as { message?: string })?.message || 'An error occurred';
              flushSync(() => {
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
              });
              break;
            }
          }
        } catch {
          // Skip invalid JSON chunks
        }
      }

      // Ensure we mark as complete even if no done event
      flushSync(() => {
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
      });
    } catch (error) {
      console.error('Stream processing failed:', error);
      flushSync(() => {
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
      });
    }
  }, []);

  // Load project data
  const loadProject = useCallback(async (id: string) => {
    console.log(`[useWorkspace] loadProject called for id: ${id}`);
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      console.log(`[useWorkspace] Fetching project and files...`);
      const [projectRes, filesRes] = await Promise.all([
        api.getProject(id),
        api.getProjectFiles(id),
      ]);

      console.log(`[useWorkspace] Project response:`, {
        success: projectRes.success,
        hasData: !!projectRes.data,
        status: projectRes.data?.status,
        filesCount: projectRes.data?.files?.length,
      });
      console.log(`[useWorkspace] Files response:`, {
        success: filesRes.success,
        filesCount: filesRes.data?.length,
        files: filesRes.data?.slice(0, 5),
      });

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
        console.log(`[useWorkspace] Built file tree with ${files.length} root nodes`);

        // Check if there's an initial prompt in the project context that needs processing
        const context = projectData.context as Record<string, unknown> | undefined;
        const initialPrompt = context?.initialPrompt as string | undefined;
        const hasReceivedMessage = context?.hasReceivedMessage as boolean | undefined;

        console.log(`[useWorkspace] Context:`, {
          hasInitialPrompt: !!initialPrompt,
          hasReceivedMessage,
          initialPromptProcessed: initialPromptProcessed.current
        });

        // If there's an initial prompt and it hasn't been processed yet
        if (initialPrompt && !hasReceivedMessage && !initialPromptProcessed.current) {
          console.log(`[useWorkspace] Processing initial prompt...`);
          initialPromptProcessed.current = true;

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

          // Use flushSync to ensure the messages are rendered before starting the stream
          flushSync(() => {
            setState((prev) => {
              console.log(`[useWorkspace] Setting state with files:`, files.length, 'nodes');
              console.log(`[useWorkspace] Setting state with messages:`, initialMessages.length, 'messages');
              return {
                ...prev,
                project,
                files,
                messages: initialMessages,
                previewUrl: project.previewUrl || null,
                isLoading: true,
              };
            });
          });
          console.log(`[useWorkspace] State updated with initial prompt, starting stream...`);

          // Start streaming the initial prompt
          processStream(id, initialPrompt, assistantMessageId);
        } else if (initialPrompt && hasReceivedMessage) {
          // Already processed - just show the user message
          console.log(`[useWorkspace] Initial prompt already processed, showing user message only`);
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
        } else {
          // No initial prompt
          console.log(`[useWorkspace] No initial prompt, setting project state`);
          setState((prev) => ({
            ...prev,
            project,
            files,
            previewUrl: project.previewUrl || null,
            isLoading: false,
          }));
        }
        console.log(`[useWorkspace] loadProject complete`);
      } else {
        console.error(`[useWorkspace] Project response not successful:`, projectRes.error);
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

      // Add pending assistant message with empty reasoning
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

  // Load project on mount - using a ref to prevent cascading renders
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (projectId && !initialLoadRef.current) {
      initialLoadRef.current = true;
      // Use setTimeout to defer the state update
      const timeoutId = setTimeout(() => {
        loadProject(projectId);
      }, 0);
      return () => clearTimeout(timeoutId);
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
