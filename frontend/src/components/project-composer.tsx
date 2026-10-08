"use client";

import { useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessageNotSentError,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadMessage,
} from "@assistant-ui/react";
import { ArrowUp, Code2, FolderOpen, LayoutGrid, LoaderCircle, PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { createProjectFromPrompt } from "@/lib/create-project";

const emptyMessages: ThreadMessage[] = [];
const suggestions = [
  { prompt: "A landing page for a coffee shop", label: "Coffee shop", Icon: PanelsTopLeft },
  { prompt: "A dashboard to track my habits", label: "Habit tracker", Icon: LayoutGrid },
  { prompt: "A portfolio with a project gallery", label: "Portfolio", Icon: FolderOpen },
];

export function ProjectComposer({ onCreated }: { onCreated: (projectId: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const runtime = useExternalStoreRuntime({
    messages: emptyMessages,
    isDisabled: creating,
    isRunning: creating,
    onNew: async (message) => {
      if (pending.current) throw new MessageNotSentError("Project creation is already in progress.");
      pending.current = true;
      setCreating(true);
      setError(null);
      let projectId: string;
      try {
        projectId = await createProjectFromPrompt(message.content, (request) => api.createProject(request));
      } catch (cause) {
        pending.current = false;
        setCreating(false);
        setError(cause instanceof Error ? cause.message : "Project could not be created. Try again.");
        // Rejection tells assistant-ui to restore the original submitted draft.
        throw cause;
      }
      onCreated(projectId);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ComposerPrimitive.Root className="aui-project-composer mt-3 overflow-hidden rounded-2xl border bg-card shadow-xl shadow-foreground/5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15">
        <ComposerPrimitive.Input
          ref={input}
          id="project-prompt"
          aria-label="Describe the app you want to build"
          aria-describedby={error ? "project-creation-error" : undefined}
          placeholder="Describe your idea. What should it do, and who is it for?"
          minRows={3}
          maxRows={10}
          unstable_insertNewlineOnTouchEnter
          addAttachmentOnPaste={false}
          className="aui-composer-input min-h-24 w-full resize-none bg-transparent p-5 text-base outline-none placeholder:text-muted-foreground sm:min-h-[clamp(6rem,15svh,8rem)]"
        />
        <div className="flex items-center justify-between gap-3 px-4 pb-4 sm:px-5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Code2 aria-hidden className="size-3.5" />Your app. Your source code.
          </span>
          <ComposerPrimitive.Send asChild>
            <Button type="button" className="w-32 shrink-0" aria-busy={creating}>
              <span>{creating ? "Creating…" : "Build app"}</span>
              {creating ? <LoaderCircle aria-hidden data-icon="inline-end" className="animate-spin" /> : <ArrowUp aria-hidden data-icon="inline-end" />}
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
      {error && <div id="project-creation-error" role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="mr-1 text-xs text-muted-foreground">Try an idea</span>
        {suggestions.map(({ prompt, label, Icon }) => (
          <ThreadPrimitive.Suggestion key={prompt} prompt={prompt} send={false} clearComposer asChild>
            <Button variant="secondary" size="sm" aria-label={prompt} onClick={() => input.current?.focus()}>
              <Icon aria-hidden data-icon="inline-start" />{label}
            </Button>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </AssistantRuntimeProvider>
  );
}
