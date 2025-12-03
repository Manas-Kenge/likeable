'use client';

import { use, useEffect } from 'react';
import { ChatWorkspace } from '@/components/chat-workspace';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChatPage({ params }: PageProps) {
  const { id } = use(params);

  useEffect(() => {
    console.log('[ChatPage] Mounted with project ID:', id);
  }, [id]);

  return <ChatWorkspace projectId={id} />;
}