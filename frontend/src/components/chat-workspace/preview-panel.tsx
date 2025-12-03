"use client";

import { useState, useRef, useCallback } from "react";
import {
  CodeIcon,
  GlobeIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  Maximize2Icon,
  MousePointerClickIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
  WebPreviewBody,
  WebPreviewConsole,
} from "@/components/ai-elements/web-preview";
import { cn } from "@/lib/utils";
import { FileExplorer } from "./file-explorer";
import { CodeEditor } from "./code-editor";
import type { FileNode, PreviewTab } from "./types";

interface PreviewPanelProps {
  files: FileNode[];
  selectedFile: FileNode | null;
  previewUrl: string | null;
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  onSelectFile: (file: FileNode) => void;
  className?: string;
}

type ConsoleLog = {
  level: "log" | "warn" | "error";
  message: string;
  timestamp: Date;
};

export function PreviewPanel({
  files,
  selectedFile,
  previewUrl,
  activeTab,
  onTabChange,
  onSelectFile,
  className,
}: PreviewPanelProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleReload = useCallback(() => {
    if (iframeRef.current) {
      const src = iframeRef.current.src;
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = src;
        }
      }, 50);
    }
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (previewUrl) {
      window.open(previewUrl, "_blank");
    }
  }, [previewUrl]);

  const handleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  return (
    <div
      className={cn(
        "flex h-full flex-col",
        fullscreen && "fixed inset-0 z-50 bg-background",
        className
      )}
    >
      {/* Tab header */}
      <div className="flex h-14 items-center justify-between border-b px-2">
        <div className="flex gap-1">
          <Button
            variant={activeTab === "code" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onTabChange("code")}
            className="gap-2"
          >
            <CodeIcon className="h-4 w-4" />
            Code
          </Button>
          <Button
            variant={activeTab === "preview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onTabChange("preview")}
            className="gap-2"
          >
            <GlobeIcon className="h-4 w-4" />
            Preview
          </Button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "code" ? (
          <div className="flex h-full">
            {/* File explorer sidebar */}
            <div className="w-64 border-r bg-muted/30">
              <FileExplorer
                files={files}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
              />
            </div>

            {/* Code editor */}
            <div className="flex-1">
              <CodeEditor file={selectedFile} />
            </div>
          </div>
        ) : (
          <WebPreview
            defaultUrl={previewUrl || ""}
            onUrlChange={(url) => console.log("URL changed to:", url)}
            className="h-full"
          >
            <WebPreviewNavigation>
              <WebPreviewNavigationButton
                onClick={() => {
                  // Browser history navigation not available in sandboxed iframe
                  console.log("Go back");
                }}
                tooltip="Go back"
                disabled={!previewUrl}
              >
                <ArrowLeftIcon className="size-4" />
              </WebPreviewNavigationButton>
              <WebPreviewNavigationButton
                onClick={() => {
                  // Browser history navigation not available in sandboxed iframe
                  console.log("Go forward");
                }}
                tooltip="Go forward"
                disabled={!previewUrl}
              >
                <ArrowRightIcon className="size-4" />
              </WebPreviewNavigationButton>
              <WebPreviewNavigationButton
                onClick={handleReload}
                tooltip="Reload"
                disabled={!previewUrl}
              >
                <RefreshCcwIcon className="size-4" />
              </WebPreviewNavigationButton>
              <WebPreviewUrl
                readOnly
                placeholder="Preview will appear here..."
                value={previewUrl || ""}
              />
              <WebPreviewNavigationButton
                onClick={() => console.log("Select element")}
                tooltip="Select element"
                disabled={!previewUrl}
              >
                <MousePointerClickIcon className="size-4" />
              </WebPreviewNavigationButton>
              <WebPreviewNavigationButton
                onClick={handleOpenExternal}
                tooltip="Open in new tab"
                disabled={!previewUrl}
              >
                <ExternalLinkIcon className="size-4" />
              </WebPreviewNavigationButton>
              <WebPreviewNavigationButton
                onClick={handleFullscreen}
                tooltip={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                <Maximize2Icon className="size-4" />
              </WebPreviewNavigationButton>
            </WebPreviewNavigation>

            <WebPreviewBody
              src={previewUrl || undefined}
              ref={iframeRef}
            />

            <WebPreviewConsole logs={consoleLogs} />
          </WebPreview>
        )}
      </div>
    </div>
  );
}
