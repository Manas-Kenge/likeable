"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Code2, Download, ExternalLink, Globe, Layers2, LoaderCircle, Monitor, MessageSquare, PanelLeftClose, PanelLeftOpen, Play, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { ChatPanel } from "./chat-panel";
import { PreviewPanel } from "./preview-panel";
import { useWorkspace } from "./use-workspace";

export function ChatWorkspace({ projectId }: { projectId?: string }) {
  const workspace = useWorkspace(projectId);
  const { project, loadingProject, generating, resuming } = workspace;
  const [chatWidth, setChatWidth] = useState(30);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [phonePreview, setPhonePreview] = useState(false);
  const [manualReload, setManualReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const previewUrl = project?.status === "running" ? project.previewUrl || null : null;

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
      workspace.setError(cause instanceof Error ? cause.message : "Export failed. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const exportButton = (
    <Button size="sm" variant="outline" className="h-7 rounded-full px-3 text-xs" disabled={!project || generating || exporting || resuming || loadingProject} onClick={() => void download()}>
      {exporting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      <span className="hidden sm:inline">Export code</span>
      <span className="sr-only sm:hidden">Export code</span>
    </Button>
  );

  const reopenButton = project && project.status !== "running" ? (
    <Button size="sm" className="h-7 shrink-0 rounded-full px-3 text-xs" disabled={resuming || loadingProject} onClick={() => void workspace.resumeProject()}>
      {resuming ? <LoaderCircle className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
      {resuming ? "Reopening…" : "Reopen"}
    </Button>
  ) : null;

  const projectMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0 gap-1.5 px-2 text-xs font-medium" aria-label="Project menu">
          <span className="truncate" title={project?.name}>{project?.name || "Loading project…"}</span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        <DropdownMenuItem asChild><Link href="/"><ArrowLeft />All projects</Link></DropdownMenuItem>
        <DropdownMenuItem disabled={loadingProject || generating || resuming} onSelect={() => void workspace.loadProject()}><RefreshCw />Refresh project status</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!project || generating || exporting || resuming || loadingProject} onSelect={() => void download()}><Download />Export code</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-sidebar/40" style={{ "--chat-width": chatCollapsed ? "56px" : `${chatWidth}%` } as React.CSSProperties}>
      <header className="flex h-12 shrink-0 items-center border-b bg-sidebar/40">
        <div className="flex h-full min-w-0 flex-1 items-center gap-1 px-2 lg:w-[calc(var(--chat-width)+1px)] lg:flex-none lg:shrink-0 lg:border-r lg:bg-sidebar/70">
          <Button asChild variant="ghost" size="icon-sm" className={cn("shrink-0 text-muted-foreground", chatCollapsed && "lg:hidden")}>
            <Link href="/" aria-label="Back to projects"><Layers2 className="size-4" /></Link>
          </Button>
          <div className={cn("min-w-0", chatCollapsed && "lg:hidden")}>{projectMenu}</div>
          <span role="status" className={cn("ml-auto hidden items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground", !chatCollapsed && "xl:flex")}>
            <span className={cn("size-1.5 rounded-full", generating ? "bg-muted-foreground" : project?.status === "running" ? "bg-emerald-600" : project?.status === "error" ? "bg-destructive" : "bg-muted-foreground")} />
            {generating ? "Building" : resuming ? "Reopening" : project?.status === "running" ? "Running" : "Saved"}
          </span>
          <Button variant="ghost" size="icon-sm" className={cn("ml-auto hidden shrink-0 text-muted-foreground lg:inline-flex", chatCollapsed ? "lg:mx-auto" : "xl:ml-1")} aria-label={chatCollapsed ? "Expand chat panel" : "Collapse chat panel"} aria-expanded={!chatCollapsed} aria-controls="workspace-chat" onClick={() => setChatCollapsed((value) => !value)}>
            {chatCollapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
          </Button>
        </div>
        <div className="hidden h-full min-w-0 flex-1 items-center gap-3 bg-background px-3 lg:flex">
          {chatCollapsed && <div className="min-w-0 max-w-40 shrink-0">{projectMenu}</div>}
          <div className="flex shrink-0 items-center gap-0.5 rounded-full border bg-background/60 p-0.5">
            {(["preview", "code"] as const).map((tab) => (
              <Button key={tab} size="sm" variant="ghost" className={cn("h-6 rounded-full px-2.5 text-xs", workspace.activeTab === tab && "bg-primary/10 text-primary hover:bg-primary/15")} onClick={() => workspace.changeTab(tab)} aria-pressed={workspace.activeTab === tab}>
                {tab === "preview" ? <Globe className="size-3.5" /> : <Code2 className="size-3.5" />}
                {tab === "preview" ? "Preview" : "Code"}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex min-w-0 max-w-sm flex-1 items-center gap-1 rounded-full border bg-background/60 px-1">
            <Button size="icon-sm" variant="ghost" className="size-6 shrink-0" disabled={!previewUrl} aria-label="Reload preview" onClick={() => setManualReload((value) => value + 1)}><RefreshCw className="size-3.5" /></Button>
            <span className="min-w-0 flex-1 truncate px-2 text-center text-xs text-muted-foreground" title={previewUrl || undefined}>{previewUrl ? new URL(previewUrl).host : "App preview"}</span>
            <Globe aria-hidden className="mr-2 size-3 shrink-0 text-muted-foreground" />
          </div>
          <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground" aria-label={phonePreview ? "Use desktop preview" : "Use phone preview"} aria-pressed={phonePreview} onClick={() => setPhonePreview((value) => !value)}>{phonePreview ? <Smartphone className="size-3.5" /> : <Monitor className="size-3.5" />}</Button>
          <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground" disabled={!previewUrl} aria-label="Open preview in a new tab" onClick={() => { if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer"); }}><ExternalLink className="size-3.5" /></Button>
          <div className="ml-auto flex shrink-0 items-center gap-2">{reopenButton}{exportButton}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pr-3 lg:hidden">{reopenButton}{exportButton}</div>
      </header>
      {workspace.error && <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive"><span>{workspace.error}</span><Button variant="outline" size="sm" disabled={generating || resuming || loadingProject} onClick={() => void workspace.loadProject()}>Reload</Button></div>}
      <nav aria-label="Workspace panels" className="flex h-10 shrink-0 items-center gap-1 border-b px-2 lg:hidden">
        {(["chat", "preview", "code"] as const).map((tab) => <Button key={tab} size="sm" variant={workspace.mobileTab === tab ? "secondary" : "ghost"} aria-pressed={workspace.mobileTab === tab} className="h-7 flex-1 text-xs capitalize" onClick={() => { workspace.setMobileTab(tab); if (tab !== "chat") workspace.changeTab(tab); }}>{tab}</Button>)}
        {workspace.mobileTab === "preview" && <Button size="icon-sm" variant="ghost" disabled={!previewUrl} aria-label="Reload preview" onClick={() => setManualReload((value) => value + 1)}><RefreshCw className="size-3.5" /></Button>}
      </nav>
      {loadingProject ? <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading your project…</div> : !project ? <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center"><h1 className="text-lg font-semibold">Project unavailable</h1><p className="text-sm text-muted-foreground">Try reloading, or return to your projects.</p><Button asChild variant="outline"><Link href="/">Back to projects</Link></Button></div> : (
        <div ref={container} className="flex min-h-0 flex-1 overflow-hidden">
          <section id="workspace-chat" aria-label="Chat panel" className={cn("min-h-0 w-full overflow-hidden lg:block lg:w-[var(--chat-width)] lg:shrink-0", workspace.mobileTab !== "chat" && "hidden")}>
            {chatCollapsed && (
              <div className="hidden h-full flex-col items-center bg-sidebar/30 py-3 lg:flex">
                <Button variant="ghost" size="icon-sm" aria-label="Expand chat panel" aria-controls="workspace-chat" aria-expanded={false} onClick={() => setChatCollapsed(false)}><MessageSquare className="size-4 text-muted-foreground" /></Button>
                <span className="mt-3 text-[11px] font-medium text-muted-foreground [writing-mode:vertical-rl]">Chat</span>
              </div>
            )}
            <div className={cn("h-full min-h-0", chatCollapsed && "lg:hidden")}>
              <ChatPanel messages={workspace.messages} generating={generating} disabled={project.status !== "running" || resuming} onSendMessage={workspace.sendMessage} onRetry={(text) => void workspace.sendMessage(text)} onSelectPath={workspace.selectPath} onShowPreview={() => workspace.changeTab("preview")} />
            </div>
          </section>
          <div role={chatCollapsed ? undefined : "separator"} aria-label={chatCollapsed ? undefined : "Resize chat panel"} aria-orientation={chatCollapsed ? undefined : "vertical"} aria-valuemin={chatCollapsed ? undefined : 25} aria-valuemax={chatCollapsed ? undefined : 50} aria-valuenow={chatCollapsed ? undefined : Math.round(chatWidth)} tabIndex={chatCollapsed ? -1 : 0} className={cn("relative hidden w-px shrink-0 touch-none border-l lg:block after:absolute after:left-1/2 after:top-1/2 after:h-8 after:w-0.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-border hover:after:bg-muted-foreground focus-visible:outline-2 focus-visible:outline-ring", chatCollapsed ? "after:hidden" : "cursor-col-resize")} onKeyDown={(event) => { if (chatCollapsed) return; if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setChatWidth((value) => Math.max(25, Math.min(50, value + (event.key === "ArrowLeft" ? -2 : 2)))); } }} onPointerDown={(event) => { if (!chatCollapsed) event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId) || !container.current) return; const bounds = container.current.getBoundingClientRect(); setChatWidth(Math.max(25, Math.min(50, ((event.clientX - bounds.left) / bounds.width) * 100))); }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
          <section aria-label="App and code panel" className={cn("min-h-0 min-w-0 flex-1 overflow-hidden bg-background lg:rounded-tl-xl lg:border-t lg:border-l", workspace.mobileTab === "chat" && "hidden", "lg:block")}>
            <PreviewPanel files={workspace.files} selectedFile={workspace.selectedFile} previewUrl={previewUrl} activeTab={workspace.activeTab} generating={generating} previewReloadTrigger={workspace.previewReloadTrigger + manualReload} mobilePreview={phonePreview} onSelectFile={(file) => void workspace.selectFile(file)} fileLoading={workspace.fileLoading} fileError={workspace.fileError} />
          </section>
        </div>
      )}
    </main>
  );
}
