"use client";
import { useEffect, useRef, useState } from "react";
import {
  FileCode2,
  Globe,
  LoaderCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./code-editor";
import { FileExplorer } from "./file-explorer";
import type { FileNode, PreviewTab } from "./types";

interface Props {
  files: FileNode[];
  selectedFile: FileNode | null;
  previewUrl: string | null;
  activeTab: PreviewTab;
  generating: boolean;
  previewReloadTrigger: number;
  mobilePreview: boolean;
  onSelectFile: (file: FileNode) => void;
  fileLoading: boolean;
  fileError: string | null;
}
export function PreviewPanel({
  files,
  selectedFile,
  previewUrl,
  activeTab,
  generating,
  previewReloadTrigger,
  mobilePreview,
  onSelectFile,
  fileLoading,
  fileError,
}: Props) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = previewUrl
    ? `${previewUrl}?reload=${previewReloadTrigger}`
    : undefined;
  const loadFailed = failedUrl === src;
  useEffect(() => {
    if (!src || loadedUrl === src) return;
    const timer = setTimeout(() => setFailedUrl(src), 20000);
    return () => clearTimeout(timer);
  }, [src, loadedUrl]);
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div
        className={cn(
          "min-h-0 flex-1 flex-col",
          activeTab === "preview" ? "flex" : "hidden",
        )}
      >
        <div className={cn("relative flex min-h-0 flex-1 justify-center overflow-auto bg-background", mobilePreview && "bg-muted/40 p-3")}>
          {previewUrl ? (
            <>
              <iframe
                ref={iframe}
                src={src}
                title="Generated app preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                className={cn(
                  "h-full min-h-64 w-full border-0 bg-background",
                  mobilePreview && "max-w-[390px] rounded-xl border shadow-sm",
                )}
                onLoad={() => {
                  setLoadedUrl(src || null);
                  setFailedUrl(null);
                }}
              />
              {loadedUrl !== src && !loadFailed && (
                <div
                  role="status"
                  className="absolute right-5 top-5 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs shadow-sm"
                >
                  <LoaderCircle className="size-3 animate-spin" />
                  Loading preview…
                </div>
              )}
              {loadFailed && (
                <div
                  role="alert"
                  className="absolute inset-x-5 top-5 rounded-xl border bg-background p-4 text-sm shadow-sm"
                >
                  The preview is taking longer than expected. Reload it, or
                  reopen the project if its session expired.
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-2xl border bg-background">
                <Globe className="size-5" />
              </span>
              <h2 className="text-sm font-medium text-foreground">
                Your app, right here
              </h2>
              <p className="max-w-xs text-sm leading-6">
                {generating
                  ? "Your app is being prepared. Follow the progress in the conversation."
                  : "Reopen the project to start its preview."}
              </p>
            </div>
          )}
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 flex-col sm:flex-row",
          activeTab === "code" ? "flex" : "hidden",
        )}
      >
        <aside className="h-36 w-full shrink-0 border-b bg-sidebar/50 sm:h-auto sm:w-48 sm:border-r sm:border-b-0">
          <div className="flex h-10 items-center gap-2 border-b px-3 text-xs font-medium text-muted-foreground">
            <FileCode2 className="size-3.5" />
            Project files
          </div>
          <div className="h-[calc(100%-2.5rem)]">
            <FileExplorer
              files={files}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
            />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <CodeEditor
            file={selectedFile}
            loading={fileLoading}
            error={fileError}
          />
        </div>
      </div>
    </div>
  );
}
