'use client';

import { Tree, Folder, File } from '@/components/ui/file-tree';
import { cn } from '@/lib/utils';
import type { FileNode } from './types';

interface FileExplorerProps {
  files: FileNode[];
  selectedFile?: FileNode | null;
  onSelectFile: (file: FileNode) => void;
  className?: string;
}

export function FileExplorer({
  files,
  selectedFile,
  onSelectFile,
  className,
}: FileExplorerProps) {
  // Get initial expanded items (expand first level folders)
  const initialExpandedItems = files
    .filter((f) => f.isFolder)
    .map((f) => f.id);

  return (
    <div className={cn('h-full', className)} style={{ backgroundColor: '#272822' }}>
      <div className="flex h-10 items-center px-3" style={{ borderBottom: '1px solid #3e3d32' }}>
        <span className="text-sm font-medium" style={{ color: '#f8f8f2' }}>Files</span>
      </div>
      <div className="h-[calc(100%-2.5rem)]">
        {files.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: '#75715e' }}>
            No files yet
          </div>
        ) : (
          <Tree
            className="p-2"
            initialExpandedItems={initialExpandedItems}
            initialSelectedId={selectedFile?.id}
          >
            {renderNodes(files, selectedFile, onSelectFile)}
          </Tree>
        )}
      </div>
    </div>
  );
}

function renderNodes(
  nodes: FileNode[],
  selectedFile: FileNode | null | undefined,
  onSelectFile: (file: FileNode) => void
): React.ReactNode {
  return nodes.map((node) => {
    if (node.isFolder && node.children) {
      return (
        <Folder
          key={node.id}
          value={node.id}
          element={node.name}
          isSelectable={true}
        >
          {renderNodes(node.children, selectedFile, onSelectFile)}
        </Folder>
      );
    }

    return (
      <File
        key={node.id}
        value={node.id}
        isSelect={selectedFile?.id === node.id}
        onClick={() => onSelectFile(node)}
      >
        <span className="truncate">{node.name}</span>
      </File>
    );
  });
}
