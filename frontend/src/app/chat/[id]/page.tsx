"use client";
import { use } from "react";
import { ChatWorkspace } from "@/components/chat-workspace";
export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ChatWorkspace key={id} projectId={id} />;
}
