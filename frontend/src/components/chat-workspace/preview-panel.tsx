"use client";
import { useEffect, useRef, useState } from "react";
import {
  Code2,
  ExternalLink,
  FileCode2,
  Globe,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onTabChange: (tab: PreviewTab) => void;
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
  onTabChange,
  onSelectFile,
  fileLoading,
  fileError,
}: Props) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [mobile, setMobile] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [manualReload, setManualReload] = useState(0);
  const src = previewUrl
    ? `${previewUrl}?reload=${previewReloadTrigger + manualReload}`
    : undefined;
  useEffect(() => {
    if (!src || loadedUrl === src) return;
    const timer = setTimeout(() => setLoadFailed(true), 20000);
    return () => clearTimeout(timer);
  }, [src, loadedUrl]);
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="hidden h-11 shrink-0 items-center justify-between border-b px-3 lg:flex">
        <div className="flex gap-1">
          {(["preview", "code"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={activeTab === tab ? "secondary" : "ghost"}
              onClick={() => onTabChange(tab)}
              aria-pressed={activeTab === tab}
            >
              {tab === "preview" ? (
                <Globe className="size-3.5" />
              ) : (
                <Code2 className="size-3.5" />
              )}
              {tab === "preview" ? "Preview" : "Code"}
            </Button>
          ))}
        </div>
        {generating && (
          <span
            role="status"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <LoaderCircle className="size-3 animate-spin" />
            Updating app
          </span>
        )}
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 flex-col",
          activeTab === "preview" ? "flex" : "hidden",
        )}
      >
        <div className="flex h-11 shrink-0 items-center gap-1 border-b bg-background px-2">
          <Globe className="mx-2 size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {previewUrl ? new URL(previewUrl).host : "Your app preview"}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={mobile ? "Use desktop preview" : "Use phone preview"}
            aria-pressed={mobile}
            onClick={() => setMobile((value) => !value)}
          >
            {mobile ? <Smartphone /> : <Monitor />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!previewUrl}
            aria-label="Reload preview"
            onClick={() => {
              setLoadFailed(false);
              setManualReload((value) => value + 1);
            }}
          >
            <RefreshCw />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!previewUrl}
            aria-label="Open preview in a new tab"
            onClick={() => {
              if (previewUrl)
                window.open(previewUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink />
          </Button>
        </div>
        <div className="relative flex min-h-0 flex-1 justify-center overflow-auto bg-muted/50 p-2 sm:p-4">
          {previewUrl ? (
            <>
              <iframe
                ref={iframe}
                src={src}
                title="Generated app preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                className={cn(
                  "h-full min-h-64 w-full rounded-lg border bg-white",
                  mobile && "max-w-[390px]",
                )}
                onLoad={() => {
                  setLoadedUrl(src || null);
                  setLoadFailed(false);
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
          "min-h-0 flex-1",
          activeTab === "code" ? "flex" : "hidden",
        )}
      >
        <aside className="w-36 shrink-0 border-r sm:w-48">
          <div className="flex h-10 items-center gap-2 border-b px-3 text-xs font-medium text-muted-foreground">
            <FileCode2 className="size-3.5" />
            Files
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
