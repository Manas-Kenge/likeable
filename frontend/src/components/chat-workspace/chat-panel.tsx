"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronRight,
  FileCode2,
  LoaderCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageResponse } from "@/components/ai-elements/message";
import type { ChatMessage } from "./types";

interface Props {
  messages: ChatMessage[];
  generating: boolean;
  disabled: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onRetry: (text: string) => void;
  onSelectPath: (path: string) => void;
}
export function ChatPanel({
  messages,
  generating,
  disabled,
  onSendMessage,
  onRetry,
  onSelectPath,
}: Props) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [messages]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || disabled || generating) return;
    const prompt = input.trim();
    setInput("");
    await onSendMessage(prompt);
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" />
        Build conversation
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5"
        role="log"
        aria-label="Build conversation"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="py-12">
            <span className="mb-4 flex size-9 items-center justify-center rounded-xl bg-muted">
              <Sparkles className="size-4" />
            </span>
            <h2 className="text-sm font-semibold">What should we build?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Describe your app, or ask for a change to the current project.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <article key={message.id} className="mb-6 min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {message.role === "user" ? (
                  "You"
                ) : (
                  <>
                    <Sparkles className="size-3" />
                    Likeable
                  </>
                )}
                {message.status === "error" && (
                  <span className="text-destructive">· Needs attention</span>
                )}
              </div>
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap rounded-xl bg-muted/70 px-3.5 py-3 text-sm leading-6">
                  {message.content}
                </p>
              ) : (
                <div className="space-y-3">
                  {message.activity?.length ? (
                    <details
                      open={message.status === "streaming"}
                      className="rounded-xl border px-3 py-2.5"
                    >
                      <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <ChevronRight className="size-3" />
                        {message.status === "streaming"
                          ? "Build activity"
                          : "View build activity"}
                      </summary>
                      <ol className="mt-3 space-y-2.5">
                        {message.activity.map((activity) => (
                          <li
                            key={activity.id}
                            className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
                          >
                            {activity.status === "active" ? (
                              <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin" />
                            ) : (
                              <Check className="mt-0.5 size-3.5 shrink-0" />
                            )}
                            <span className="break-all">{activity.label}</span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : message.status === "streaming" ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="size-4 animate-spin" />
                      Working on your request…
                    </div>
                  ) : null}
                  {message.content && (
                    <div
                      className={
                        message.status === "error"
                          ? "text-sm text-destructive"
                          : "text-sm leading-6"
                      }
                    >
                      <MessageResponse>{message.content}</MessageResponse>
                    </div>
                  )}
                  {message.changes.length > 0 && (
                    <div className="space-y-1">
                      {[
                        ...new Set(
                          message.changes.map((change) => change.path),
                        ),
                      ].map((path) => (
                        <button
                          key={path}
                          onClick={() => onSelectPath(path)}
                          className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate font-mono">{path}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {message.status === "error" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={generating || disabled}
                      onClick={() =>
                        onRetry(
                          messages
                            .slice(0, index)
                            .findLast((item) => item.role === "user")
                            ?.content ||
                            "Fix the build errors in this project.",
                        )
                      }
                    >
                      <RotateCcw className="size-3" />
                      Retry request
                    </Button>
                  )}
                </div>
              )}
            </article>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="shrink-0 border-t p-3">
        <div className="overflow-hidden rounded-xl border bg-card focus-within:ring-2 focus-within:ring-ring/30">
          <label className="sr-only" htmlFor="chat-prompt">
            Describe a change
          </label>
          <Textarea
            id="chat-prompt"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe an app or ask for a change…"
            disabled={disabled || generating}
            className="min-h-24 resize-none border-0 bg-transparent p-3 text-sm shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-[11px] text-muted-foreground">
              {generating
                ? "Building your changes…"
                : "Make it yours, one change at a time."}
            </span>
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Send message"
              disabled={!input.trim() || generating || disabled}
            >
              {generating ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
