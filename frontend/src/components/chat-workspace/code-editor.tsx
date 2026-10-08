"use client";
import Editor from "@monaco-editor/react";
import { FileCode2, LoaderCircle } from "lucide-react";
import type { FileNode } from "./types";

export function CodeEditor({
  file,
  loading,
  error,
}: {
  file: FileNode | null;
  loading: boolean;
  error: string | null;
}) {
  if (!file)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <FileCode2 className="size-6" />
        <p className="text-sm">Choose a file to explore the code.</p>
      </div>
    );
  const languages: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
    toml: "ini",
    yml: "yaml",
    yaml: "yaml",
  };
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
        <span className="truncate font-mono text-xs">{file.path}</span>
        <span className="shrink-0 rounded border bg-sidebar px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Read only
        </span>
      </div>
      {error ? (
        <p role="alert" className="p-5 text-sm text-destructive">
          {error}
        </p>
      ) : loading ? (
        <div
          role="status"
          className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" />
          Loading file…
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            path={file.path}
            language={
              languages[file.name.split(".").pop() || ""] || "plaintext"
            }
            value={file.content ?? ""}
            theme="vs"
            loading={
              <span className="text-sm text-muted-foreground">
                Loading code viewer…
              </span>
            }
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              padding: { top: 16 },
              fontFamily: "var(--font-geist-mono), monospace",
              smoothScrolling: false,
            }}
          />
        </div>
      )}
    </div>
  );
}
