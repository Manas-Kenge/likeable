'use client';

import { cn } from '@/lib/utils';
import { ChatPanel } from './chat-panel';
import { PreviewPanel } from './preview-panel';
import { useWorkspace } from './use-workspace';

interface ChatWorkspaceProps {
  projectId?: string;
  className?: string;
}

export function ChatWorkspace({ projectId, className }: ChatWorkspaceProps) {
  const {
    project,
    messages,
    files,
    selectedFile,
    activeTab,
    isLoading,
    previewUrl,
    previewReloadTrigger,
    sendMessage,
    selectFile,
    setActiveTab,
  } = useWorkspace(projectId);

  return (
    <div className={cn('flex h-screen', className)}>
      {/* Left panel - Chat */}
      <div className="w-1/2 border-r">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSendMessage={sendMessage}
          projectName={project?.name}
        />
      </div>

      {/* Right panel - Code/Preview */}
      <div className="w-1/2">
        <PreviewPanel
          files={files}
          selectedFile={selectedFile}
          previewUrl={previewUrl}
          activeTab={activeTab}
          isLoading={isLoading}
          previewReloadTrigger={previewReloadTrigger}
          onTabChange={setActiveTab}
          onSelectFile={selectFile}
        />
      </div>
    </div>
  );
}
