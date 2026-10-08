"use client";

import { createContext, useContext, useState, type ComponentType } from "react";
import {
  AssistantRuntimeProvider,
  getExternalStoreMessages,
  useAuiState,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { Check, FileCode2, LoaderCircle, RotateCcw, X } from "lucide-react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { convertMessage, getPromptText, getRetryPrompt } from "./assistant-runtime";
import type { ChatMessage } from "./types";

interface Props {
  messages: ChatMessage[];
  generating: boolean;
  disabled: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onRetry: (text: string) => void;
  onSelectPath: (path: string) => void;
  onShowPreview: () => void;
}

const BuildContext = createContext<Props | null>(null);

function BuildMessageExtras() {
  const context = useContext(BuildContext);
  const message = useAuiState((s) => getExternalStoreMessages<ChatMessage>(s.message)[0]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!context || !message) return null;
  const { messages, generating, disabled, onRetry, onSelectPath, onShowPreview } = context;
  const streaming = message.status === "streaming";
  const failed = message.status === "error";
  const paths = [...new Set(message.changes.map((change) => change.path))];
  if (!streaming && !failed && !paths.length && !message.activity?.length) return null;

  return (
    <div className="mb-4 space-y-3">
      <Collapsible open={detailsOpen || streaming} onOpenChange={setDetailsOpen} className="overflow-hidden rounded-2xl border bg-background/70">
        <div className="flex min-h-12 items-center gap-3 border-b px-4 py-3">
          <span className="min-w-0 flex-1 text-xs font-semibold">
            {streaming ? "Building your changes…" : failed ? "Build needs attention" : paths.length ? `Updated ${paths.length} ${paths.length === 1 ? "file" : "files"}` : "Build complete"}
          </span>
          {streaming ? <LoaderCircle aria-hidden className="size-3.5 shrink-0 animate-spin text-muted-foreground" /> : failed ? <X aria-hidden className="size-3.5 shrink-0 text-destructive" /> : <Check aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
        </div>
        <div className="grid grid-cols-2 gap-2 p-2">
          <CollapsibleTrigger asChild><Button variant="outline" size="sm" className="h-8 rounded-full text-xs">Details</Button></CollapsibleTrigger>
          <Button variant="secondary" size="sm" className="h-8 rounded-full border text-xs" onClick={onShowPreview}>Preview</Button>
        </div>
        <CollapsibleContent>
          <div className="space-y-4 border-t px-4 py-3">
            {!!message.activity?.length && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Build activity</p>
                <ol className="space-y-2">
                  {message.activity.map((activity) => (
                    <li key={activity.id} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                      {activity.status === "active" ? <LoaderCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 animate-spin" /> : activity.status === "error" ? <X aria-hidden className="mt-0.5 size-3.5 shrink-0 text-destructive" /> : <Check aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                      <span className="break-words [overflow-wrap:anywhere]">{activity.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {paths.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Changed files</p>
                <div className="flex flex-col gap-1">
                  {paths.map((path) => <Button key={path} variant="ghost" size="sm" className="h-auto min-h-8 max-w-full justify-start px-0 py-1.5 text-xs" onClick={() => onSelectPath(path)}><FileCode2 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 break-all text-left font-mono">{path}</span></Button>)}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
      {failed && <Button variant="outline" size="sm" disabled={generating || disabled} onClick={() => onRetry(getRetryPrompt(messages, message.id))}><RotateCcw aria-hidden className="size-3" />Retry request</Button>}
    </div>
  );
}

function BuildWelcome() {
  return (
    <div className="mb-6 px-2">
      <h2 className="text-2xl font-medium tracking-tight">What should we build?</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Describe your app, or ask for a change to this project.</p>
    </div>
  );
}

const threadComponents: { AssistantMessageExtras: ComponentType; Welcome: ComponentType } = {
  AssistantMessageExtras: BuildMessageExtras,
  Welcome: BuildWelcome,
};

export function ChatPanel(props: Props) {
  const { messages, generating, disabled, onSendMessage } = props;
  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage,
    isRunning: generating,
    isDisabled: disabled,
    onNew: async (message) => {
      const prompt = getPromptText(message.content);
      if (prompt) await onSendMessage(prompt);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <BuildContext.Provider value={props}>
        <div className="h-full min-h-0 text-sm" role="region" aria-label="Build conversation">
          <Thread components={threadComponents} autoFocus={false} />
        </div>
      </BuildContext.Provider>
    </AssistantRuntimeProvider>
  );
}
