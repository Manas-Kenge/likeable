"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Code2,
  Download,
  LoaderCircle,
  MessageSquare,
  Play,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { ChatPanel } from "./chat-panel";
import { PreviewPanel } from "./preview-panel";
import { useWorkspace } from "./use-workspace";

export function ChatWorkspace({ projectId }: { projectId?: string }) {
  const workspace = useWorkspace(projectId);
  const { project, loadingProject, generating, resuming } = workspace;
  const [chatWidth, setChatWidth] = useState(34);
  const [exporting, setExporting] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  async function download() {
    if (!project || exporting) return;
    setExporting(true);
    try {
      const result = await fetch(api.exportUrl(project.id));
      if (!result.ok) {
        const body = await result.json();
        throw new Error(body.error || "Export failed");
      }
      const url = URL.createObjectURL(await result.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name.replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) || "project"}.zip`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      workspace.setError(
        cause instanceof Error ? cause.message : "Export failed. Try again.",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <main className="flex h-dvh min-h-0 flex-col bg-background">
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/" aria-label="Back to projects">
              <ArrowLeft />
            </Link>
          </Button>
          <span className="hidden size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:flex">
            <Code2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {project?.name || "Loading project…"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Likeable workspace
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {project && (
            <Badge
              variant="secondary"
              className="hidden capitalize sm:inline-flex"
            >
              {generating ? "Building" : project.status}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh project status"
            disabled={loadingProject || generating || resuming}
            onClick={() => void workspace.loadProject()}
          >
            <RefreshCw />
          </Button>
          {project && project.status !== "running" && (
            <Button
              size="sm"
              disabled={resuming}
              onClick={() => void workspace.resumeProject()}
            >
              {resuming ? <LoaderCircle className="animate-spin" /> : <Play />}
              {resuming ? "Reopening…" : "Reopen"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={
              !project || generating || exporting || resuming || loadingProject
            }
            onClick={() => void download()}
          >
            {exporting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Download />
            )}
            <span className="hidden sm:inline">Export code</span>
            <span className="sr-only sm:hidden">Export code</span>
          </Button>
        </div>
      </header>
      {workspace.error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>{workspace.error}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={generating || resuming || loadingProject}
            onClick={() => void workspace.loadProject()}
          >
            Reload
          </Button>
        </div>
      )}
      {project && project.status !== "running" && !loadingProject && (
        <div
          role="status"
          className="border-b bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
        >
          {resuming
            ? "Restoring your saved files and starting the preview…"
            : "This project is saved. Reopen it to continue building and start its preview."}
        </div>
      )}
      <nav
        aria-label="Workspace panels"
        className="flex shrink-0 gap-1 border-b p-2 lg:hidden"
      >
        {(["chat", "preview", "code"] as const).map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={workspace.mobileTab === tab ? "secondary" : "ghost"}
            aria-pressed={workspace.mobileTab === tab}
            className="flex-1 capitalize"
            onClick={() => {
              workspace.setMobileTab(tab);
              if (tab !== "chat") workspace.changeTab(tab);
            }}
          >
            {tab === "chat" && <MessageSquare className="size-3.5" />}
            {tab}
          </Button>
        ))}
      </nav>
      {loadingProject ? (
        <div
          role="status"
          className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" />
          Loading your project…
        </div>
      ) : !project ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
          <h1 className="text-lg font-semibold">Project unavailable</h1>
          <p className="text-sm text-muted-foreground">
            Try reloading, or return to your projects.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Back to projects</Link>
          </Button>
        </div>
      ) : (
        <div
          ref={container}
          className="flex min-h-0 flex-1 overflow-hidden"
          style={{ "--chat-width": `${chatWidth}%` } as React.CSSProperties}
        >
          <section
            aria-label="Chat panel"
            className={cn(
              "min-h-0 w-full lg:block lg:w-[var(--chat-width)] lg:shrink-0",
              workspace.mobileTab !== "chat" && "hidden",
            )}
          >
            <ChatPanel
              messages={workspace.messages}
              generating={generating}
              disabled={project.status !== "running" || resuming}
              onSendMessage={workspace.sendMessage}
              onRetry={(text) => void workspace.sendMessage(text)}
              onSelectPath={workspace.selectPath}
            />
          </section>
          <div
            role="separator"
            aria-label="Resize chat panel"
            aria-orientation="vertical"
            aria-valuemin={25}
            aria-valuemax={50}
            aria-valuenow={Math.round(chatWidth)}
            tabIndex={0}
            className="hidden w-1 shrink-0 cursor-col-resize touch-none border-x bg-muted/40 hover:bg-primary/20 focus-visible:bg-primary/20 focus-visible:outline-2 focus-visible:outline-ring lg:block"
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                setChatWidth((value) =>
                  Math.max(
                    25,
                    Math.min(50, value + (event.key === "ArrowLeft" ? -2 : 2)),
                  ),
                );
              }
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (
                !event.currentTarget.hasPointerCapture(event.pointerId) ||
                !container.current
              )
                return;
              const bounds = container.current.getBoundingClientRect();
              setChatWidth(
                Math.max(
                  25,
                  Math.min(
                    50,
                    ((event.clientX - bounds.left) / bounds.width) * 100,
                  ),
                ),
              );
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          />
          <section
            aria-label="App and code panel"
            className={cn(
              "min-h-0 min-w-0 flex-1 lg:block",
              workspace.mobileTab === "chat" && "hidden",
            )}
          >
            <PreviewPanel
              files={workspace.files}
              selectedFile={workspace.selectedFile}
              previewUrl={
                project.status === "running" ? project.previewUrl || null : null
              }
              activeTab={workspace.activeTab}
              generating={generating}
              previewReloadTrigger={workspace.previewReloadTrigger}
              onTabChange={workspace.changeTab}
              onSelectFile={(file) => void workspace.selectFile(file)}
              fileLoading={workspace.fileLoading}
              fileError={workspace.fileError}
            />
          </section>
        </div>
      )}
    </main>
  );
}
