'use client';

import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { GlobeIcon } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { useState } from "react";

const models = [
  { name: "GPT 4o", value: "openai/gpt-4o" },
  { name: "Deepseek R1", value: "deepseek/deepseek-r1" },
];

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const [model, setModel] = useState(models[0].value);
  const [webSearch, setWebSearch] = useState(false);
  const { sendMessage, status } = useChat();

  const projects: Array<{
    id: string;
    title: string;
    description: string;
    image: string;
  }> = [];

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text && !message.files?.length) return;

    sendMessage(
      {
        text: message.text,
        files: message.files,
      },
      {
        body: { model, webSearch },
      }
    );

    setInput("");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background">

      {/* TOPBAR */}
      <div className="h-16 flex items-center px-6 text-xl font-semibold">
        Lovable
      </div>

      {/* CENTERED & WIDER PROMPT */}
      <div className="flex-1 flex items-center justify-center px-4">
        {/* No border, no card, expanded width */}
        <div className="w-full max-w-3xl">
          <PromptInput onSubmit={handleSubmit} globalDrop multiple>
            <PromptInputHeader />

            <PromptInputBody>
              <PromptInputTextarea
                onChange={(e) => setInput(e.target.value)}
                value={input}
                placeholder="Describe what you want to build..."
              />
            </PromptInputBody>

            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>

                <PromptInputButton
                  variant={webSearch ? "default" : "ghost"}
                  onClick={() => setWebSearch(!webSearch)}
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>

                <PromptInputSelect
                  onValueChange={setModel}
                  value={model}
                >
                  <PromptInputSelectTrigger>
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {models.map((m) => (
                      <PromptInputSelectItem key={m.value} value={m.value}>
                        {m.name}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>

              <PromptInputSubmit
                disabled={!input && !status}
                status={status}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>

      {/* PAST PROJECTS SECTION */}
      <div className="px-6 py-8">
        <h2 className="text-lg font-semibold mb-4">Past Projects</h2>

        <div className="mx-6">
          {projects.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-32 w-full" />
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-2/3 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {projects.map((p) => (
                <Card key={p.id} className="overflow-hidden hover:shadow-md transition">
                  <img src={p.image} alt={p.title} className="h-32 w-full object-cover" />
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm">{p.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-xs">
                    {p.description}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBotDemo;
