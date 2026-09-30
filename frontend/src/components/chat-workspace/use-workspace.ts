"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Project } from "@/lib/api";
import type { Activity, ChatMessage, FileNode, PreviewTab } from "./types";

function buildTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];
  for (const path of [...paths].sort()) {
    let children = root;
    const parts = path.split("/");
    parts.forEach((name, index) => {
      const itemPath = parts.slice(0, index + 1).join("/");
      let node = children.find((item) => item.path === itemPath);
      if (!node) {
        node = {
          id: itemPath,
          path: itemPath,
          name,
          isFolder: index < parts.length - 1,
          children: index < parts.length - 1 ? [] : undefined,
        };
        children.push(node);
      }
      if (node.children) children = node.children;
    });
  }
  return root;
}

export function useWorkspace(projectId?: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [activeTab, setActiveTab] = useState<PreviewTab>("preview");
  const [mobileTab, setMobileTab] = useState<"chat" | PreviewTab>("chat");
  const [loadingProject, setLoadingProject] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewReloadTrigger, setPreviewReloadTrigger] = useState(0);
  const projectRef = useRef<Project | null>(null);
  const runRef = useRef(false);
  const started = useRef(false);
  const fileRequest = useRef(0);
  const selectedRef = useRef<FileNode | null>(null);
  const activityRef = useRef<Activity[]>([]);

  const applyProject = useCallback((data: Project) => {
    projectRef.current = data;
    setProject(data);
    setFiles(buildTree(data.files));
    setMessages((previous) =>
      data.messages.map((message) => ({
        ...message,
        activity: previous.find((item) => item.id === message.id)?.activity,
      })),
    );
    setGenerating(data.generationStatus === "running");
  }, []);

  const selectFile = useCallback(async (file: FileNode, activate = true) => {
    if (!projectRef.current) return;
    const request = ++fileRequest.current;
    selectedRef.current = file;
    setSelectedFile({ ...file, content: undefined });
    setFileLoading(true);
    setFileError(null);
    if (activate) {
      setActiveTab("code");
      setMobileTab("code");
    }
    const result = await api.getFileContent(projectRef.current.id, file.path);
    if (request !== fileRequest.current) return;
    if (result.success && result.data) {
      const next = { ...file, content: result.data.content };
      selectedRef.current = next;
      setSelectedFile(next);
    } else
      setFileError(
        result.error || "File could not be loaded. Select it to try again.",
      );
    setFileLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string, initial = false) => {
      const current = projectRef.current;
      if (
        !current ||
        runRef.current ||
        current.status !== "running" ||
        current.generationStatus === "running"
      )
        return;
      runRef.current = true;
      setGenerating(true);
      setError(null);
      activityRef.current = [];
      const runId = crypto.randomUUID();
      const assistantId = `draft-${runId}`;
      const timestamp = new Date().toISOString();
      setMessages((previous) => [
        ...previous,
        {
          id: `user-${runId}`,
          role: "user",
          content: text,
          timestamp,
          status: "complete",
          runId,
          changes: [],
        },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp,
          status: "streaming",
          runId,
          changes: [],
          activity: [],
        },
      ]);
      const updateAssistant = (update: Partial<ChatMessage>) =>
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId ? { ...message, ...update } : message,
          ),
        );
      let changes: ChatMessage["changes"] = [];
      let terminalRunId: string | undefined;
      function activity(label: string) {
        activityRef.current = [
          ...activityRef.current.map((item) => ({
            ...item,
            status: "complete" as const,
          })),
          { id: crypto.randomUUID(), label, status: "active" },
        ];
        updateAssistant({ activity: [...activityRef.current] });
      }
      try {
        for await (const event of api.streamMessage(current.id, text, {
          initial,
        })) {
          switch (event.type) {
            case "thinking":
              activity(event.data.message);
              break;
            case "plan":
              activity(`Plan: ${event.data.join(" · ")}`);
              break;
            case "step":
              activity(
                event.data.path
                  ? `Reading ${event.data.path}`
                  : event.data.toolName === "run_command"
                    ? "Running command"
                    : "Exploring project files",
              );
              break;
            case "file_start":
              activity(`Writing ${event.data.path}`);
              break;
            case "file_complete":
              changes = [
                ...changes.filter((change) => change.path !== event.data.path),
                event.data,
              ];
              updateAssistant({ changes });
              break;
            case "validating":
              activity(event.data.message);
              break;
            case "message":
              updateAssistant({ content: event.data.text });
              break;
            case "preview_ready":
              setPreviewReloadTrigger((value) => value + 1);
              break;
            case "done":
              terminalRunId = event.data.runId;
              updateAssistant({
                content: event.data.text,
                status: "complete",
                activity: activityRef.current.map((item) => ({
                  ...item,
                  status: "complete",
                })),
              });
              break;
            case "error":
              updateAssistant({
                content: event.data.message,
                status: "error",
                activity: activityRef.current.map((item) => ({
                  ...item,
                  status: "error",
                })),
              });
              break;
          }
        }
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Generation was interrupted. Try again.";
        updateAssistant({ content: message, status: "error", changes });
        setError(message);
      } finally {
        const result = await api.getProject(current.id);
        if (result.success && result.data) {
          applyProject(result.data);
          setMessages((previous) =>
            previous.map((message) =>
              message.role === "assistant" &&
              (message.runId === terminalRunId ||
                message.id === result.data?.messages.at(-1)?.id)
                ? {
                    ...message,
                    activity: activityRef.current.map((item) => ({
                      ...item,
                      status: message.status === "error" ? "error" : "complete",
                    })),
                  }
                : message,
            ),
          );
          if (selectedRef.current) void selectFile(selectedRef.current, false);
        } else {
          setGenerating(false);
          setError(
            result.error ||
              "Could not refresh the project. Reload to check its state.",
          );
        }
        runRef.current = false;
      }
    },
    [applyProject, selectFile],
  );

  const loadProject = useCallback(
    async (autoStart = false) => {
      if (!projectId) return;
      setLoadingProject(true);
      setError(null);
      const result = await api.getProject(projectId);
      if (result.success && result.data) {
        applyProject(result.data);
        if (
          autoStart &&
          result.data.initialPrompt &&
          !result.data.initialRunId &&
          result.data.status === "running"
        )
          void sendMessage(result.data.initialPrompt, true);
      } else setError(result.error || "Project could not be loaded.");
      setLoadingProject(false);
    },
    [projectId, applyProject, sendMessage],
  );

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void loadProject(true);
    }
  }, [loadProject]);
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(async () => {
      if (runRef.current || !projectId) return;
      const result = await api.getProject(projectId);
      if (result.success && result.data) applyProject(result.data);
    }, 3000);
    return () => clearInterval(timer);
  }, [generating, projectId, applyProject]);

  const resumeProject = useCallback(async () => {
    if (!projectId || runRef.current) return;
    setResuming(true);
    setError(null);
    const result = await api.resumeProject(projectId);
    if (result.success && result.data) {
      applyProject(result.data);
      setPreviewReloadTrigger((value) => value + 1);
      if (result.data.initialPrompt && !result.data.initialRunId)
        void sendMessage(result.data.initialPrompt, true);
    } else setError(result.error || "Project could not be reopened.");
    setResuming(false);
  }, [projectId, applyProject, sendMessage]);

  function selectPath(path: string) {
    void selectFile({
      id: path,
      name: path.split("/").pop() || path,
      path,
      isFolder: false,
    });
  }
  function changeTab(tab: PreviewTab) {
    setActiveTab(tab);
    setMobileTab(tab);
  }
  return {
    project,
    messages,
    files,
    selectedFile,
    activeTab,
    mobileTab,
    loadingProject,
    generating,
    resuming,
    error,
    fileLoading,
    fileError,
    previewReloadTrigger,
    sendMessage,
    selectFile,
    selectPath,
    changeTab,
    setMobileTab,
    loadProject,
    resumeProject,
    setError,
  };
}
