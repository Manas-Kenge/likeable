'use client';

import Editor from '@monaco-editor/react';
import { cn } from '@/lib/utils';
import type { FileNode } from './types';

interface CodeEditorProps {
  file: FileNode | null;
  className?: string;
  onContentChange?: (content: string) => void;
}

// Map file extensions to Monaco languages
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
  };
  return languageMap[ext] || 'plaintext';
}

export function CodeEditor({ file, className, onContentChange }: CodeEditorProps) {
  if (!file) {
    return (
      <div
        className={cn(
          'flex h-full items-center justify-center bg-muted/30 text-muted-foreground',
          className
        )}
      >
        <div className="text-center">
          <p className="text-sm">Select a file to view its content</p>
        </div>
      </div>
    );
  }

  const language = getLanguage(file.name);

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* File header */}
      <div className="flex h-10 items-center border-b bg-muted/30 px-3">
        <span className="text-sm font-medium">{file.path}</span>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          value={file.content || '// Loading...'}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 12 },
          }}
          onChange={(value: string | undefined) => {
            if (value && onContentChange) {
              onContentChange(value);
            }
          }}
        />
      </div>
    </div>
  );
}
