'use client';

import Editor, { type Monaco } from '@monaco-editor/react';
import { cn } from '@/lib/utils';
import type { FileNode } from './types';

interface CodeEditorProps {
  file: FileNode | null;
  className?: string;
  onContentChange?: (content: string) => void;
}

// Monokai color palette for consistent styling
const monokaiColors = {
  background: '#272822',
  foreground: '#f8f8f2',
  comment: '#75715e',
  border: '#3e3d32',
};

// Define Monokai theme inline
const monokaiTheme = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '75715e' },
    { token: 'string', foreground: 'e6db74' },
    { token: 'number', foreground: 'ae81ff' },
    { token: 'keyword', foreground: 'f92672' },
    { token: 'type', foreground: '66d9ef' },
    { token: 'class', foreground: 'a6e22e' },
    { token: 'function', foreground: 'a6e22e' },
    { token: 'variable', foreground: 'f8f8f2' },
    { token: 'constant', foreground: 'ae81ff' },
  ],
  colors: {
    'editor.background': '#272822',
    'editor.foreground': '#f8f8f2',
    'editor.lineHighlightBackground': '#3e3d32',
    'editorLineNumber.foreground': '#90908a',
    'editor.selectionBackground': '#49483e',
    'editor.inactiveSelectionBackground': '#49483e',
    'editorCursor.foreground': '#f8f8f0',
  },
};

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

// Handle Monaco editor mount and define theme
const handleEditorWillMount = (monaco: Monaco) => {
  monaco.editor.defineTheme('monokai', monokaiTheme as any);
};

export function CodeEditor({ file, className, onContentChange }: CodeEditorProps) {
  if (!file) {
    return (
      <div
        className={cn(
          'flex h-full items-center justify-center text-muted-foreground',
          className
        )}
        style={{ backgroundColor: monokaiColors.background }}
      >
        <div className="text-center">
          <p className="text-sm" style={{ color: monokaiColors.comment }}>Select a file to view its content</p>
        </div>
      </div>
    );
  }

  const language = getLanguage(file.name);

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* File header - Monokai styled */}
      <div
        className="flex h-10 items-center border-b px-3"
        style={{
          backgroundColor: monokaiColors.background,
          borderColor: monokaiColors.border,
        }}
      >
        <span className="text-sm font-medium" style={{ color: monokaiColors.foreground }}>{file.path}</span>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          value={file.content || '// Loading...'}
          theme="monokai"
          beforeMount={handleEditorWillMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 12 },
            fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
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