'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader } from '@/components/ai-elements/loader';

import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';

import { GlobeIcon } from 'lucide-react';
import { api, type Project } from '@/lib/api';

const SUGGESTIONS = [
  'Create a responsive navbar with Tailwind CSS',
  'Build a todo app with React',
  'Make a landing page for a coffee shop',
  'Add a dark mode toggle',
];

const NewChatPage = () => {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Load existing projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await api.getProjects();
        if (response.success && response.data) {
          setProjects(response.data);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!message.text?.trim() || isCreating) return;

    setIsCreating(true);

    try {
      // Create a new project with the initial prompt
      const response = await api.createProject({
        name: message.text.slice(0, 50), // Use first 50 chars as project name
        description: message.text,
        initialPrompt: message.text,
      });

      if (response.success && response.data) {
        // Navigate to the chat page with the new project ID
        router.push(`/chat/${response.data.id}`);
      } else {
        console.error('Failed to create project:', response.error);
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      setIsCreating(false);
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/chat/${projectId}`);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* TOPBAR */}
      <div className="h-16 flex items-center px-6 text-xl font-semibold">
        Likeable
      </div>

      {/* CENTERED PROMPT */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold mb-2">
              What can we build together?
            </h1>
            <p className="text-muted-foreground">
              Describe your idea and I&apos;ll help you bring it to life.
            </p>
          </div>

          {/* Suggestions */}
          <div className="mb-6">
            <Suggestions>
              {SUGGESTIONS.map((suggestion) => (
                <Suggestion
                  key={suggestion}
                  suggestion={suggestion}
                  onClick={(s) => setInput(s)}
                />
              ))}
            </Suggestions>
          </div>

          <PromptInput onSubmit={handleSubmit} globalDrop multiple>
            <PromptInputHeader />

            <PromptInputBody>
              <PromptInputTextarea
                onChange={(e) => setInput(e.target.value)}
                value={input}
                placeholder="Describe what you want to build..."
                disabled={isCreating}
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
                  variant={webSearch ? 'default' : 'ghost'}
                  onClick={() => setWebSearch(!webSearch)}
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
              </PromptInputTools>

              {isCreating ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader size={16} />
                  <span>Creating project...</span>
                </div>
              ) : (
                <PromptInputSubmit disabled={!input.trim()} />
              )}
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>

      {/* PAST PROJECTS SECTION */}
      <div className="px-6 py-8">
        <h2 className="text-lg font-semibold mb-4">Past Projects</h2>

        <div className="mx-6">
          {isLoadingProjects ? (
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
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No projects yet. Start by describing what you want to build!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="overflow-hidden hover:shadow-md transition cursor-pointer"
                  onClick={() => handleProjectClick(project.id)}
                >
                  <div className="h-32 w-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <span className="text-4xl opacity-50">🚀</span>
                  </div>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm truncate">
                      {project.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          project.status === 'running'
                            ? 'bg-green-500'
                            : project.status === 'error'
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                        }`}
                      />
                      <span className="capitalize">{project.status}</span>
                    </div>
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

export default NewChatPage;
