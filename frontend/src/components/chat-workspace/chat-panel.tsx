"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Shimmer } from "@/components/ai-elements/shimmer";

import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { cn } from "@/lib/utils";
import type { ChatMessage, ReasoningStep } from "./types";
import {
  BrainIcon,
  WrenchIcon,
  FileIcon,
  CheckCircle2Icon,
  Loader2Icon,
  FileEditIcon,
  FileSearchIcon,
  TerminalIcon,
} from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  className?: string;
  projectName?: string;
}

// Get icon for reasoning step — uses full step for per-tool-name icons
function getStepIcon(step: ReasoningStep | string) {
  const type = typeof step === 'string' ? step : step.type;
  const toolName = typeof step === 'string' ? undefined : step.toolName;

  if (type === 'tool_call') {
    if (toolName === 'read_file' || toolName === 'list_files') return FileSearchIcon;
    if (toolName === 'run_command') return TerminalIcon;
    return WrenchIcon;
  }
  switch (type) {
    case 'thinking': return BrainIcon;
    case 'file_change': return FileIcon;
    case 'file_working': return FileEditIcon;
    default: return CheckCircle2Icon;
  }
}

// Render step label with shimmer for active states
function StepLabel({ step }: { step: ReasoningStep }) {
  if (step.status === 'active') {
    return <Shimmer duration={1.5}>{step.label}</Shimmer>;
  }
  return <span>{step.label}</span>;
}

export function ChatPanel({
  messages,
  isLoading,
  onSendMessage,
  className,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (promptMessage: PromptInputMessage) => {
    const text = promptMessage.text?.trim();
    if (!text || isLoading) return;

    setInputValue("");
    onSendMessage(text);
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <Link href="/">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <h1 className="text-lg font-semibold">Likeable</h1>
        </div>
      </Link>
      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((msg) => (
              <Message key={msg.id} from={msg.role}>
                <MessageContent>
                  {msg.status === "streaming" ? (
                    <div className="space-y-3">
                      {/* Chain of Thought for streaming messages */}
                      {msg.reasoning && msg.reasoning.length > 0 && (
                        <ChainOfThought defaultOpen={true}>
                          <ChainOfThoughtHeader>
                            <span className="flex items-center gap-2">
                              <Loader2Icon className="size-3 animate-spin" />
                              <Shimmer duration={2}>Working on your request...</Shimmer>
                            </span>
                          </ChainOfThoughtHeader>
                          <ChainOfThoughtContent>
                            {msg.reasoning.map((step) => (
                              <ChainOfThoughtStep
                                key={step.id}
                                icon={getStepIcon(step)}
                                label={<StepLabel step={step} />}
                                description={step.description}
                                status={step.status}
                              />
                            ))}
                          </ChainOfThoughtContent>
                        </ChainOfThought>
                      )}
                      {(!msg.reasoning || msg.reasoning.length === 0) && (
                        <div className="flex items-center gap-2">
                          <Loader />
                          <Shimmer duration={1.5}>Thinking...</Shimmer>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Chain of Thought for completed messages */}
                      {msg.reasoning && msg.reasoning.length > 0 && (
                        <ChainOfThought defaultOpen={false}>
                          <ChainOfThoughtHeader>
                            {msg.reasoning.length} step
                            {msg.reasoning.length !== 1 ? "s" : ""} completed
                          </ChainOfThoughtHeader>
                          <ChainOfThoughtContent>
                            {msg.reasoning.map((step) => (
                              <ChainOfThoughtStep
                                key={step.id}
                                icon={getStepIcon(step)}
                                label={step.label}
                                description={step.description}
                                status="complete"
                              />
                            ))}
                          </ChainOfThoughtContent>
                        </ChainOfThought>
                      )}
                      {/* Final message content */}
                      <div>{msg.content}</div>
                    </div>
                  )}
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
        </Conversation>
      </div>

      {/* Input area */}
      <div className="p-4">
        <PromptInput
          onSubmit={handleSubmit}
          className="w-full max-w-2xl mx-auto relative"
        >
          <PromptInputTextarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe what you want to build..."
            className="min-h-[80px] flex items-center pt-[32px]"
          />
          <PromptInputSubmit
            className="absolute bottom-5 right-3"
            disabled={!inputValue.trim() || isLoading}
            status={isLoading ? "streaming" : "ready"}
          />
        </PromptInput>
      </div>
    </div>
  );
}
