"use client";
import { ChevronRight, FileCode2, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileNode } from "./types";

export function FileExplorer({
  files,
  selectedFile,
  onSelectFile,
}: {
  files: FileNode[];
  selectedFile: FileNode | null;
  onSelectFile: (file: FileNode) => void;
}) {
  function nodes(items: FileNode[]): React.ReactNode {
    return items.map((item) =>
      item.isFolder ? (
        <details key={item.path} open className="group/folder">
          <summary className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted">
            <ChevronRight className="size-3 group-open/folder:rotate-90" />
            <Folder className="size-3.5" />
            {item.name}
          </summary>
          <div className="ml-3 border-l pl-1">{nodes(item.children || [])}</div>
        </details>
      ) : (
        <button
          key={item.path}
          type="button"
          title={item.path}
          aria-current={selectedFile?.path === item.path ? "true" : undefined}
          onClick={() => onSelectFile(item)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
            selectedFile?.path === item.path &&
              "bg-background font-medium shadow-xs ring-1 ring-border",
          )}
        >
          <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{item.name}</span>
        </button>
      ),
    );
  }
  return (
    <nav aria-label="Project files" className="h-full overflow-auto p-2">
      {files.length ? (
        nodes(files)
      ) : (
        <p className="p-3 text-xs text-muted-foreground">
          No source files available.
        </p>
      )}
    </nav>
  );
}
